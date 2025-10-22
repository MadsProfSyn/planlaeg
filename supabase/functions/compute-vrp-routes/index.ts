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

    // Call the external Railway VRP API for optimized route planning
    const railwayApiUrl = "https://web-production-1b301.up.railway.app/schedule";
    
    console.log("Calling external VRP API:", railwayApiUrl);

    let railwayData: any;
    
    try {
      const railwayResponse = await fetch(railwayApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inspection_ids,
          target_dates,
        }),
        signal: AbortSignal.timeout(90000), // 90 second timeout
      });

      if (!railwayResponse.ok) {
        const errorText = await railwayResponse.text();
        throw new Error(`VRP API returned ${railwayResponse.status}: ${errorText}`);
      }

      railwayData = await railwayResponse.json();

      console.log("VRP API response:", {
        assignments_count: railwayData.assignments?.length || 0,
        total_scheduled: railwayData.metrics?.total_scheduled,
        execution_seconds: railwayData.metrics?.execution_seconds,
      });

      if (!railwayData.assignments || railwayData.assignments.length === 0) {
        throw new Error("Ingen synskonsulenter tilgængelige på de valgte datoer");
      }

    } catch (error: any) {
      console.error("Railway VRP API error:", error);
      
      // Provide user-friendly error messages
      let userMessage = "Kunne ikke beregne rute. Prøv igen.";
      
      if (error.name === "TimeoutError" || error.message?.includes("timeout")) {
        userMessage = "Rute-beregning tog for lang tid. Prøv med færre syn.";
      } else if (error.message?.includes("fetch") || error.message?.includes("network")) {
        userMessage = "Rute-serveren svarer ikke. Prøv igen om et øjeblik.";
      } else if (error.message?.includes("tilgængelige")) {
        userMessage = error.message;
      } else if (error.message?.includes("no solution")) {
        userMessage = "Kunne ikke finde optimal rute for de valgte syn.";
      }
      
      throw new Error(userMessage);
    }

    // Transform Railway API response to match our VrpRoutePlan interface
    const assignments = railwayData.assignments.map((a: any) => {
      const inspection = inspections.find((i: any) => i.id === a.inspection_id);
      const inspector = inspectors.find((i: any) => i.inspector_id === a.inspector_id);
      
      // Defensive time handling with fallbacks
      const startTime = a.start_time 
        ? (typeof a.start_time === 'string' ? a.start_time.substring(0, 5) : String(a.start_time))
        : "09:00";
        
      const endTime = a.end_time 
        ? (typeof a.end_time === 'string' ? a.end_time.substring(0, 5) : String(a.end_time))
        : "17:00";
      
      return {
        inspection_id: a.inspection_id,
        inspector_id: a.inspector_id,
        inspector_name: a.inspector_name || inspector?.full_name || "Ukendt synskonsulent",
        scheduled_date: a.date,
        start_time: startTime,
        end_time: endTime,
        sequence_in_route: a.sequence,
        travel_from_previous_mins: a.travel_mins || 0,
        inspection_address: inspection?.address || "Ukendt adresse",
        inspection_type: inspection?.type_code || a.inspection_type,
      };
    });

    const metrics = railwayData.metrics || {};
    const totalDistanceKm = metrics.total_travel_km || 0;
    const totalTravelMinutes = metrics.total_travel_minutes || 0;

    const routePlan = {
      ordered_syn_ids: assignments.map((a: any) => a.inspection_id),
      assignments,
      total_distance_km: totalDistanceKm,
      total_eta_minutes: totalTravelMinutes,
      legs: assignments.map((a: any, i: number) => ({
        from_syn_id: i > 0 ? assignments[i - 1].inspection_id : null,
        to_syn_id: a.inspection_id,
        eta_minutes: a.travel_from_previous_mins,
        distance_km: totalTravelMinutes > 0 
          ? (a.travel_from_previous_mins / totalTravelMinutes) * totalDistanceKm 
          : 0,
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
