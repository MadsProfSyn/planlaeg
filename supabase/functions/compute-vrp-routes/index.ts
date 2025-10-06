import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VrpRequest {
  inspection_ids: string[];
  target_dates: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { inspection_ids, target_dates }: VrpRequest = await req.json();

    console.log("Computing VRP routes for:", {
      inspection_ids,
      target_dates,
    });

    // Call the database function to get VRP input data
    const { data: vrpInput, error: inputError } = await supabase.rpc(
      "get_vrp_input",
      {
        p_inspection_ids: inspection_ids,
        p_target_dates: target_dates,
      }
    );

    if (inputError) {
      throw new Error(`Failed to get VRP input: ${inputError.message}`);
    }

    console.log("VRP input fetched:", {
      inspections_count: vrpInput?.inspections?.length || 0,
      inspectors_count: vrpInput?.inspectors?.length || 0,
      existing_shifts_count: vrpInput?.existing_shifts?.length || 0,
    });

    const inspections = vrpInput?.inspections || [];
    const inspectors = vrpInput?.inspectors || [];
    const existingShifts = vrpInput?.existing_shifts || [];

    // Simple greedy assignment algorithm
    // In production, this would use OR-Tools or similar optimization library
    const assignments: any[] = [];
    const inspectorWorkload = new Map<string, number>();

    // Initialize inspector workload tracking
    inspectors.forEach((inspector: any) => {
      inspectorWorkload.set(inspector.inspector_id, 0);
    });

    // Sort inspections by preferred date
    const sortedInspections = [...inspections].sort((a, b) =>
      a.preferred_date.localeCompare(b.preferred_date)
    );

    // Simple assignment: assign each inspection to the first available inspector with matching skills
    for (const inspection of sortedInspections) {
      // Find inspectors available on this date with matching skills
      const availableInspectors = inspectors.filter((inspector: any) => {
        const isAvailable = inspector.date_local === inspection.preferred_date;
        const hasSkills = inspector.can_do_types?.includes(
          inspection.type_code
        );
        return isAvailable && hasSkills;
      });

      if (availableInspectors.length === 0) {
        console.warn(`No available inspector for inspection ${inspection.id}`);
        continue;
      }

      // Pick inspector with least workload
      const selectedInspector = availableInspectors.reduce((prev: any, curr: any) => {
        const prevWorkload = inspectorWorkload.get(prev.inspector_id) || 0;
        const currWorkload = inspectorWorkload.get(curr.inspector_id) || 0;
        return currWorkload < prevWorkload ? curr : prev;
      });

      const currentWorkload = inspectorWorkload.get(selectedInspector.inspector_id) || 0;
      const startTimeMinutes = parseTimeToMinutes(selectedInspector.start_time_local) + currentWorkload;
      const durationMinutes = inspection.duration_minutes || 60;
      const endTimeMinutes = startTimeMinutes + durationMinutes;

      // Simple travel time estimation (5 minutes per inspection as placeholder)
      const travelMinutes = assignments.length > 0 ? 5 : 0;

      assignments.push({
        inspection_id: inspection.id,
        inspector_id: selectedInspector.inspector_id,
        inspector_name: selectedInspector.full_name,
        scheduled_date: inspection.preferred_date,
        start_time: minutesToTime(startTimeMinutes),
        end_time: minutesToTime(endTimeMinutes),
        sequence_in_route: assignments.length + 1,
        travel_from_previous_mins: travelMinutes,
        inspection_address: inspection.address,
        inspection_type: inspection.type_code,
      });

      // Update workload
      inspectorWorkload.set(
        selectedInspector.inspector_id,
        currentWorkload + durationMinutes + travelMinutes
      );
    }

    // Calculate route metrics
    const totalTravelMinutes = assignments.reduce(
      (sum, a) => sum + (a.travel_from_previous_mins || 0),
      0
    );
    const totalDistanceKm = totalTravelMinutes * 0.8; // Rough estimate: 0.8 km per minute

    const routePlan = {
      ordered_syn_ids: assignments.map((a) => a.inspection_id),
      assignments,
      total_distance_km: totalDistanceKm,
      total_eta_minutes: totalTravelMinutes,
      legs: assignments.map((a, i) => ({
        from_syn_id: i > 0 ? assignments[i - 1].inspection_id : null,
        to_syn_id: a.inspection_id,
        eta_minutes: a.travel_from_previous_mins,
        distance_km: a.travel_from_previous_mins * 0.8,
      })),
    };

    console.log("VRP computation complete:", {
      assignments_count: assignments.length,
      total_travel_minutes: totalTravelMinutes,
    });

    return new Response(
      JSON.stringify({
        success: true,
        route_plan: routePlan,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("VRP computation error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Helper functions
function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}
