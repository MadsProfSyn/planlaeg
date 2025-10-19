import { supabase } from "@/integrations/supabase/client";
import type {
  VrpComputeRequest,
  VrpComputeResponse,
  VrpApprovalRequest,
  VrpApprovalResponse,
  VrpRoutePlan,
} from "@/types/vrp";

/**
 * Call the VRP edge function to compute optimal routes for selected inspections
 */
export async function computeVrpRoutes(
  inspectionIds: string[],
  targetDates: string[]
): Promise<VrpRoutePlan> {
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

  if (!data?.success || !data.route_plan) {
    throw new Error(data?.error || "Failed to compute routes");
  }

  return data.route_plan;
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
  const inspectionRecords = mondayItems.map((item) => ({
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
    status: "PENDING",
    geocode_status: "pending",
  }));

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
 * Group VRP assignments by inspector for better route visualization
 */
export function groupAssignmentsByInspector(
  routePlan: VrpRoutePlan,
  inspections: any[]
): import("@/types/vrp").GroupedRoutePlan {
  // Create a map for quick inspection lookup
  const inspectionMap = new Map(inspections.map((i) => [i.id, i]));

  // Group assignments by inspector
  const grouped = new Map<string, import("@/types/vrp").VrpAssignment[]>();

  routePlan.assignments.forEach((assignment) => {
    const existing = grouped.get(assignment.inspector_id) || [];
    grouped.set(assignment.inspector_id, [...existing, assignment]);
  });

  // Calculate totals per inspector
  const inspector_routes: import("@/types/vrp").InspectorRouteSummary[] = Array.from(
    grouped.entries()
  ).map(([inspector_id, assignments]) => {
    // Sort by sequence_in_route
    const sorted = assignments.sort(
      (a, b) => a.sequence_in_route - b.sequence_in_route
    );

    // Calculate total travel time
    const total_travel_mins = sorted.reduce(
      (sum, a) => sum + a.travel_from_previous_mins,
      0
    );

    // Estimate inspection time (assuming 60 mins per inspection)
    const total_inspection_mins = sorted.length * 60;
    const total_time_mins = total_travel_mins + total_inspection_mins;

    // Calculate distance from legs for this inspector
    const assignmentIds = new Set(sorted.map((a) => a.inspection_id));
    const relevantLegs = routePlan.legs.filter(
      (leg) =>
        leg.to_syn_id && assignmentIds.has(leg.to_syn_id)
    );
    const total_distance_km = relevantLegs.reduce(
      (sum, leg) => sum + leg.distance_km,
      0
    );

    return {
      inspector_id,
      inspector_name: assignments[0].inspector_name,
      assignments: sorted,
      total_time_mins,
      total_distance_km,
      total_inspections: assignments.length,
    };
  });

  // Find unassigned inspections
  const assigned_ids = new Set(
    routePlan.assignments.map((a) => a.inspection_id)
  );
  const unassigned = inspections.filter((i) => !assigned_ids.has(i.id));

  return {
    inspector_routes,
    unassigned_inspections: unassigned,
    overall_total_time: routePlan.total_eta_minutes,
    overall_total_distance: routePlan.total_distance_km,
  };
}
