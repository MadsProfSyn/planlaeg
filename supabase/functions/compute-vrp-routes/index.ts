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
    console.log("Step 1: Calling get_vrp_input RPC with:", {
      p_inspection_ids: inspection_ids,
      p_target_dates: target_dates,
    });

    const { data: vrpInput, error: inputError } = await supabase.rpc(
      "get_vrp_input",
      {
        p_inspection_ids: inspection_ids,
        p_target_dates: target_dates,
      }
    );

    if (inputError) {
      console.error("Step 1 FAILED: get_vrp_input RPC error:", {
        message: inputError.message,
        details: inputError.details,
        hint: inputError.hint,
        code: inputError.code,
      });
      throw new Error(`Failed to get VRP input: ${inputError.message} ${inputError.details || ''}`);
    }

    console.log("Step 1 SUCCESS: VRP input fetched:", {
      inspections_count: vrpInput?.inspections?.length || 0,
      inspectors_count: vrpInput?.inspectors?.length || 0,
      inspector_capacity_count: vrpInput?.inspector_capacity?.length || 0,
      full_vrp_input: JSON.stringify(vrpInput, null, 2),
    });

    const inspections = vrpInput?.inspections || [];
    const inspectors = vrpInput?.inspectors || [];
    const inspectorCapacity = vrpInput?.inspector_capacity || [];

    // Call the external Railway VRP API for optimized route planning
    const railwayApiUrl = "https://web-production-1b301.up.railway.app/api/schedule";
    
    const requestPayload = {
      inspection_ids,
      target_dates,
    };

    console.log("Step 2: Calling external VRP API:", {
      url: railwayApiUrl,
      method: "POST",
      payload: requestPayload,
    });

    let railwayData: any;
    
    try {
      const railwayResponse = await fetch(railwayApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
        signal: AbortSignal.timeout(90000), // 90 second timeout
      });

      console.log("Step 2: Railway API response received:", {
        status: railwayResponse.status,
        statusText: railwayResponse.statusText,
        ok: railwayResponse.ok,
        headers: Object.fromEntries(railwayResponse.headers.entries()),
      });

      if (!railwayResponse.ok) {
        const errorText = await railwayResponse.text();
        console.error("Step 2 FAILED: Railway API error response:", {
          status: railwayResponse.status,
          statusText: railwayResponse.statusText,
          body: errorText,
        });
        throw new Error(`VRP API returned ${railwayResponse.status}: ${errorText}`);
      }

      railwayData = await railwayResponse.json();
      
      console.log("Step 2 SUCCESS: Railway API response parsed:", {
        has_job_id: !!railwayData.job_id,
        has_assignments: !!railwayData.assignments,
        full_response: JSON.stringify(railwayData, null, 2),
      });

      // Check if this is a job queue response (has job_id)
      if (railwayData.job_id) {
        console.log("VRP job queued:", railwayData.job_id);
        
        // Return job info to frontend for polling
        return new Response(
          JSON.stringify({
            success: true,
            job_id: railwayData.job_id,
            status: railwayData.status || "pending",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log("VRP API response:", {
        assignments_count: railwayData.assignments?.length || 0,
        total_scheduled: railwayData.metrics?.total_scheduled,
        execution_seconds: railwayData.metrics?.execution_seconds,
      });

      if (!railwayData.assignments || railwayData.assignments.length === 0) {
        throw new Error("Ingen synskonsulenter tilgængelige på de valgte datoer");
      }

    } catch (error: any) {
      console.error("Step 2 FAILED: Railway VRP API error:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      
      // Handle 409 blocked response
      if (error.message?.includes("409")) {
        console.log("Step 2: VRP job blocked (409)");
        return new Response(
          JSON.stringify({
            success: false,
            error: "En anden VRP-beregning kører. Vent venligst.",
            blocked: true,
            debug_error: error.message,
          }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      // Return the actual error message for debugging
      console.error("Step 2: Throwing error with full details");
      throw new Error(`Railway API Error: ${error.message}`);
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
        scheduled_at: a.scheduled_at || `${a.date}T${startTime}`,
        scheduled_end: a.scheduled_end || `${a.date}T${endTime}`,
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
  } catch (error: any) {
    console.error("TOP LEVEL ERROR - VRP computation failed:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
      full_error: JSON.stringify(error, null, 2),
    });
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unknown error occurred",
        error_name: error.name,
        error_stack: error.stack,
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
