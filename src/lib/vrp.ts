import { supabase } from "@/integrations/supabase/client";
import type {
  VrpComputeRequest,
  VrpComputeResponse,
  VrpApprovalRequest,
  VrpApprovalResponse,
  VrpRoutePlan,
  VrpJobStatusResponse,
  VrpAssignment,
} from "@/types/vrp";

/**
 * Call the VRP edge function to compute optimal routes for selected inspections
 */
export async function computeVrpRoutes(
  inspectionIds: string[],
  targetDates: string[]
): Promise<VrpRoutePlan | VrpComputeResponse> {
  const { data, error } = await supabase.functions.invoke<VrpComputeResponse>(
    "compute-vrp-routes",
    {
      body: {
        inspection_ids: inspectionIds,
        target_dates: targetDates,
      } as VrpComputeRequest,
    }
  );

  if (error) {
    throw new Error(`VRP computation failed: ${error.message}`);
  }

  if (!data?.success) {
    if (data?.blocked) {
      return { 
        success: false,
        job_id: "", 
        status: "blocked", 
        blocked: true 
      };
    }
    throw new Error(data?.error || "Failed to compute routes");
  }

  // If job queue response (has job_id), return the full response
  if (data.job_id) {
    return data;
  }

  // Otherwise return route_plan (backwards compatible)
  if (!data.route_plan) {
    throw new Error("No route plan or job ID returned");
  }

  return data.route_plan;
}

/**
 * Poll Railway API for VRP job status
 */
export async function pollVrpJobStatus(jobId: string): Promise<VrpJobStatusResponse> {
  const railwayUrl = "https://web-production-1b301.up.railway.app";
  
  const response = await fetch(`${railwayUrl}/api/job-status/${jobId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to check job status: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Approve VRP assignments and persist to database
 */
export async function approveVrpAssignments(
  request: VrpApprovalRequest
): Promise<VrpApprovalResponse> {
  const { data, error } = await supabase.functions.invoke<VrpApprovalResponse>(
    "approve-vrp-assignments",
    {
      body: request,
    }
  );

  if (error) {
    throw new Error(`VRP approval failed: ${error.message}`);
  }

  if (!data?.success) {
    throw new Error(data?.error || "Failed to approve assignments");
  }

  return data;
}

/**
 * Transform Monday items to inspection queue records for VRP processing
 */
export async function transformMondayItemsToInspections(
  mondayItemIds: number[]
): Promise<string[]> {
  // Fetch Monday items by IDs
  const { data: mondayItems, error: fetchError } = await supabase
    .from("monday_items_selected")
    .select("*")
    .in("id", mondayItemIds);

  if (fetchError) {
    throw new Error(`Failed to fetch Monday items: ${fetchError.message}`);
  }

  if (!mondayItems || mondayItems.length === 0) {
    throw new Error("No Monday items found");
  }

  // Transform and insert into inspection_queue
  const inspectionRecords = mondayItems.map((item) => {
    const rawData = (item.raw as Record<string, any>) || {};
    
    return {
      monday_item_id: item.id,
      address: item.adresse || "",
      inspection_type: item.synstype || "Ukendt",
      rooms: item.antal_vaerelser || 0,
      preferred_date: item.dato_tid
        ? new Date(item.dato_tid).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      customer_name: item.Kunde || "",
      lease_number: item.lejemalsnr || "",
      department: item.landsdel || "Ukendt",
      
      // Extract from raw JSONB for WorkFeed comment
      notes: rawData.Note || "",
      obs: rawData.OBS || "",
      tenant_name: rawData.Lejersnavn || "",
      
      status: "PENDING",
      geocode_status: "pending",
    };
  });

  const { data: created, error: insertError } = await supabase
    .from("inspection_queue")
    .insert(inspectionRecords)
    .select("id");

  if (insertError) {
    throw new Error(`Failed to create inspections: ${insertError.message}`);
  }

  const inspectionIds = created.map((record) => record.id);

  // Trigger geocoding for the new inspections
  const { error: geocodeError } = await supabase.functions.invoke(
    "geocode-addresses",
    {
      body: { inspection_ids: inspectionIds },
    }
  );

  if (geocodeError) {
    console.warn("Geocoding failed:", geocodeError);
    // Don't throw - allow process to continue with partial data
  }

  return inspectionIds;
}

/**
 * Fetch inspections by IDs for VRP modal display
 */
export async function getInspectionsByIds(inspectionIds: string[]) {
  const { data, error } = await supabase
    .from("inspection_queue")
    .select("*")
    .in("id", inspectionIds);

  if (error) {
    throw new Error(`Failed to fetch inspections: ${error.message}`);
  }

  return data || [];
}

/**
 * Fetch VRP assignments from database by vrp_run_id and reconstruct VrpRoutePlan
 */
export async function fetchAssignmentsByVrpRunId(vrpRunId: string): Promise<VrpRoutePlan> {
  console.log('📦 Fetching assignments from database for VRP run:', vrpRunId);
  
  // Query proposed_assignments table
  const { data: assignments, error } = await supabase
    .from('proposed_assignments')
    .select('*')
    .eq('vrp_run_id', vrpRunId)
    .order('scheduled_date')
    .order('sequence_in_route');
  
  if (error) {
    throw new Error(`Failed to fetch assignments: ${error.message}`);
  }
  
  if (!assignments || assignments.length === 0) {
    throw new Error('No assignments found for this VRP run');
  }

  console.log('📊 Found assignments:', assignments.length);
  
  // Get unique inspector IDs
  const inspectorIds = [...new Set(assignments.map(a => a.inspector_id))];
  
  // Fetch inspector details
  const { data: inspectors, error: inspectorError } = await supabase
    .from('inspectors')
    .select('id, full_name')
    .in('id', inspectorIds);
  
  if (inspectorError) {
    console.warn('Failed to fetch inspector names:', inspectorError);
  }
  
  const inspectorMap = new Map(inspectors?.map(i => [i.id, i.full_name]) || []);
  
  // Fetch inspection details for addresses
  const inspectionIds = [...new Set(assignments.map(a => a.inspection_id))];
  const { data: inspections, error: inspectionError } = await supabase
    .from('inspection_queue')
    .select('id, address, inspection_type')
    .in('id', inspectionIds);
  
  if (inspectionError) {
    console.warn('Failed to fetch inspection details:', inspectionError);
  }
  
  const inspectionMap = new Map(inspections?.map(i => [i.id, i]) || []);
  
  // Transform database rows to VrpAssignment format
  const vrpAssignments: VrpAssignment[] = assignments.map(a => {
    const inspection = inspectionMap.get(a.inspection_id);
    return {
      inspection_id: a.inspection_id,
      inspector_id: a.inspector_id,
      inspector_name: inspectorMap.get(a.inspector_id) || 'Ukendt',
      scheduled_date: a.scheduled_date,
      start_time: a.start_time,
      end_time: a.end_time,
      sequence_in_route: a.sequence_in_route,
      travel_from_previous_mins: a.travel_from_previous_mins || 0,
      inspection_address: inspection?.address,
      inspection_type: inspection?.inspection_type,
      scheduled_at: `${a.scheduled_date}T${a.start_time}`,
      scheduled_end: `${a.scheduled_date}T${a.end_time}`,
    };
  });
  
  // Calculate totals from assignments
  const totalTravelMins = vrpAssignments.reduce((sum, a) => sum + a.travel_from_previous_mins, 0);
  
  console.log('✅ Route plan loaded:', { 
    assignmentsCount: vrpAssignments.length,
    inspectors: inspectorIds.length,
    totalTravelMins
  });
  
  // Build VrpRoutePlan object
  return {
    ordered_syn_ids: vrpAssignments.map(a => a.inspection_id),
    assignments: vrpAssignments,
    total_distance_km: 0, // Not stored per assignment, use summary from response
    total_eta_minutes: totalTravelMins,
    legs: [], // Legs not stored in DB, but not needed for display
  };
}

/**
 * Haversine distance formula (km)
 */
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Group VRP assignments by inspector for better route visualization
 */
export function groupAssignmentsByInspector(
  routePlan: VrpRoutePlan,
  inspections: any[],
  inspectorBases?: Map<string, { id: string; full_name: string; address: string | null; lat: number | null; lng: number | null }>,
  roundtripEnabled?: boolean
): import("@/types/vrp").GroupedRoutePlan {
  // Defensive defaults
  const assignments = routePlan?.assignments ?? [];
  const legs = routePlan?.legs ?? [];

  // Group assignments by inspector
  const grouped = new Map<string, import("@/types/vrp").VrpAssignment[]>();
  assignments.forEach((assignment) => {
    const existing = grouped.get(assignment.inspector_id) || [];
    grouped.set(assignment.inspector_id, [...existing, assignment]);
  });

  // Calculate totals per inspector
  const inspector_routes: import("@/types/vrp").InspectorRouteSummary[] = Array.from(grouped.entries()).map(
    ([inspector_id, inspectorAssignments]) => {
      const sorted = inspectorAssignments
        .slice()
        .sort((a, b) => a.sequence_in_route - b.sequence_in_route);

      const total_travel_mins = sorted.reduce(
        (sum, a) => sum + (a.travel_from_previous_mins || 0),
        0
      );
      const total_inspection_mins = sorted.length * 60; // naive estimate
      const total_time_mins = total_travel_mins + total_inspection_mins;

      // Calculate distance from legs for this inspector (if available)
      const assignmentIds = new Set(sorted.map((a) => a.inspection_id));
      const relevantLegs = (legs || []).filter(
        (leg) => leg.to_syn_id && assignmentIds.has(leg.to_syn_id)
      );
      const total_distance_km = relevantLegs.reduce(
        (sum, leg) => sum + (leg.distance_km || 0),
        0
      );

      const summary: import("@/types/vrp").InspectorRouteSummary = {
        inspector_id,
        inspector_name: sorted[0]?.inspector_name || "Ukendt",
        assignments: sorted,
        total_time_mins,
        total_distance_km,
        total_inspections: sorted.length,
      };

      // Calculate roundtrip distance if enabled and base data available
      if (roundtripEnabled && inspectorBases) {
        const base = inspectorBases.get(inspector_id);
        if (base?.lat && base?.lng && base.address) {
          summary.base_address = base.address;

          const firstAssignment = sorted[0];
          const lastAssignment = sorted[sorted.length - 1];

          const firstInspection = inspections.find(i => i.id === firstAssignment.inspection_id);
          const lastInspection = inspections.find(i => i.id === lastAssignment.inspection_id);

          if (firstInspection?.lat && firstInspection?.lng && lastInspection?.lat && lastInspection?.lng) {
            const distanceToFirst = haversineDistance(
              base.lat, base.lng,
              firstInspection.lat, firstInspection.lng
            );

            const distanceFromLast = haversineDistance(
              lastInspection.lat, lastInspection.lng,
              base.lat, base.lng
            );

            summary.distance_to_first_km = distanceToFirst;
            summary.distance_from_last_km = distanceFromLast;
            summary.roundtrip_distance_km = distanceToFirst + total_distance_km + distanceFromLast;
          } else {
            console.warn(`Missing inspection coordinates for roundtrip calculation: ${inspector_id}`);
          }
        } else {
          console.warn(`Missing base data for inspector: ${inspector_id}`);
        }
      }

      return summary;
    }
  );

  // Find unassigned inspections
  const assigned_ids = new Set(assignments.map((a) => a.inspection_id));
  const unassigned = inspections.filter((i) => !assigned_ids.has(i.id));

  return {
    inspector_routes,
    unassigned_inspections: unassigned,
    overall_total_time:
      routePlan?.total_eta_minutes ?? inspector_routes.reduce((s, r) => s + r.total_time_mins, 0),
    overall_total_distance: routePlan?.total_distance_km ?? 0,
  };
}
