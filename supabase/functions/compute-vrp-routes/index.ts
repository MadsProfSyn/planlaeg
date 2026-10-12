import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireStaff } from '../_shared/auth.ts';

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

  const denied = await requireStaff(req);
  if (denied) return denied;

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

    // Phase 5: Add comprehensive diagnostic logging
    console.log("Step 1.5: Data validation summary:", {
      target_dates,
      target_inspection_ids: inspection_ids,
      inspections: {
        count: inspections.length,
        sample_ids: inspections.slice(0, 2).map((i: any) => i.id),
        sample_data: inspections.slice(0, 2).map((i: any) => ({
          id: i.id,
          address: i.address,
          type: i.inspection_type,
          preferred_date: i.preferred_date,
          has_coords: !!(i.lat && i.lng),
        })),
      },
      inspectors: {
        count: inspectors.length,
        sample: inspectors.slice(0, 2).map((i: any) => ({
          id: i.inspector_id,
          name: i.full_name,
          date: i.date_local,
          start: i.start_time_local,
          end: i.end_time_local,
          has_coords: !!(i.home_lat && i.home_lng),
        })),
      },
      inspector_capacity: {
        count: inspectorCapacity.length,
        sample: inspectorCapacity.slice(0, 3).map((ic: any) => ({
          name: ic.inspector_name,
          date: ic.date_local,
          start: ic.start_time_local,
          end: ic.end_time_local,
          total_mins: ic.total_minutes,
          booked_mins: ic.booked_minutes,
          remaining_mins: ic.remaining_minutes,
          capacity_status: ic.capacity_status,
        })),
        null_times_count: inspectorCapacity.filter((ic: any) => !ic.start_time_local || !ic.end_time_local).length,
      },
    });

    // Validate that no inspectors have NULL time ranges
    const invalidInspectors = inspectorCapacity.filter(
      (ic: any) => !ic.start_time_local || !ic.end_time_local
    );

    if (invalidInspectors.length > 0) {
      console.error("❌ Phase 4: Inspectors with NULL time ranges detected:", {
        count: invalidInspectors.length,
        details: invalidInspectors.map((ic: any) => ({
          inspector_name: ic.inspector_name,
          date: ic.date_local,
          start_time: ic.start_time_local,
          end_time: ic.end_time_local,
        })),
      });
      throw new Error(
        `Nogle synskonsulenter mangler arbejdstider (${invalidInspectors.length} registreringer). ` +
        `Kontakt administrator. Påvirkede: ${invalidInspectors.map((i: any) => `${i.inspector_name} (${i.date_local})`).join(', ')}`
      );
    }

    // Call the external Railway VRP API for optimized route planning
    const railwayApiUrl = "https://web-production-1b301.up.railway.app/api/schedule";
    const railwayBaseUrl = "https://web-production-1b301.up.railway.app";
    
    const requestPayload = {
      inspection_ids,
      target_dates,
    };

    console.log("Step 2: Creating VRP job:", {
      url: railwayApiUrl,
      method: "POST",
      payload: requestPayload,
      inspection_count: inspections.length,
      inspector_count: inspectors.length,
      inspector_capacity_count: inspectorCapacity.length,
    });

    let railwayData: any;
    
    try {
      // Step 2: Create the VRP job (short timeout - just creating job)
      const railwayResponse = await fetch(railwayApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
        signal: AbortSignal.timeout(5000), // 5 second timeout for job creation
      });

      console.log("Step 2: Railway API response received:", {
        status: railwayResponse.status,
        statusText: railwayResponse.statusText,
        ok: railwayResponse.ok,
      });

      if (!railwayResponse.ok) {
        const errorText = await railwayResponse.text();
        console.error("Step 2 FAILED: Railway API error response:", {
          status: railwayResponse.status,
          statusText: railwayResponse.statusText,
          body: errorText,
        });
        
        // Handle 409 - another job is running
        if (railwayResponse.status === 409) {
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { message: errorText };
          }
          
          console.log("Step 2: VRP job blocked (409) - another calculation is running");
          return new Response(
            JSON.stringify({
              success: false,
              error: "En anden VRP-beregning kører i øjeblikket. Vent venligst og prøv igen.",
              blocked: true,
              status: "blocked",
              retry_after: errorData.retry_after || 30,
            }),
            {
              status: 409,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        
        throw new Error(`VRP API returned ${railwayResponse.status}: ${errorText}`);
      }

      railwayData = await railwayResponse.json();
      
      console.log("Step 2 SUCCESS: Railway API response parsed:", {
        status: railwayData.status,
        job_id: railwayData.job_id,
        has_vrp_run_id: !!railwayData.vrp_run_id,
      });

      // Check if job completed immediately (unlikely with worker)
      if (railwayData.status === "completed" && railwayData.vrp_run_id) {
        console.log("Step 2: VRP job completed immediately (legacy):", {
          job_id: railwayData.job_id,
          vrp_run_id: railwayData.vrp_run_id,
        });
        
        return new Response(
          JSON.stringify({
            success: true,
            job_id: railwayData.job_id,
            vrp_run_id: railwayData.vrp_run_id,
            status: "completed",
            summary: railwayData.summary,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      // Step 3: Job created - poll for completion
      if (railwayData.status === 'pending' && railwayData.job_id) {
        const jobId = railwayData.job_id;
        console.log(`Step 3: Job created (${jobId}), polling for completion...`);

        const maxAttempts = 40; // 40 × 3 seconds = 2 minutes max
        let attempts = 0;

        while (attempts < maxAttempts) {
          // Wait 3 seconds before checking
          await new Promise(resolve => setTimeout(resolve, 3000));
          attempts++;

          const elapsedSeconds = attempts * 3;
          console.log(`Step 3: Polling attempt ${attempts}/${maxAttempts} (${elapsedSeconds}s elapsed) for job ${jobId}`);

          try {
            const statusResponse = await fetch(
              `${railwayBaseUrl}/api/job-status/${jobId}`,
              {
                method: "GET",
                headers: { "Content-Type": "application/json" },
                signal: AbortSignal.timeout(5000),
              }
            );

            if (!statusResponse.ok) {
              console.warn(`Step 3: Status check failed (${statusResponse.status}), will retry...`);
              continue;
            }

            const statusData = await statusResponse.json();
            console.log(`Step 3: Job status: ${statusData.status}`, {
              attempt: attempts,
              elapsed_seconds: elapsedSeconds,
            });

            if (statusData.status === 'completed') {
              console.log("Step 3 SUCCESS: VRP job completed!", {
                job_id: jobId,
                vrp_run_id: statusData.result?.vrp_run_id,
                duration_seconds: elapsedSeconds,
                summary: statusData.result,
              });

              // Job completed - return success with results
              return new Response(JSON.stringify({
                success: true,
                job_id: jobId,
                vrp_run_id: statusData.result?.vrp_run_id,
                status: 'completed',
                summary: statusData.result,
              }), {
                headers: {
                  ...corsHeaders,
                  "Content-Type": "application/json",
                },
              });
            }

            if (statusData.status === 'failed') {
              console.error("Step 3 FAILED: VRP job failed:", statusData.error);
              throw new Error(statusData.error || 'VRP calculation failed');
            }

            // Status is still 'running' or 'pending' - continue polling
          } catch (pollError: any) {
            console.warn(`Step 3: Poll error (attempt ${attempts}):`, {
              name: pollError.name,
              message: pollError.message,
            });
            // Continue polling unless we're out of attempts
          }
        }

        // Timeout after max attempts
        console.error("Step 3 FAILED: VRP job timed out after 2 minutes");
        return new Response(
          JSON.stringify({
            success: false,
            error: "VRP-beregningen tog for lang tid (over 2 minutter). Tjek job-status manuelt eller prøv igen.",
            status: "timeout",
            job_id: jobId,
          }),
          {
            status: 408,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Unexpected response format
      console.error("Step 2 FAILED: Unexpected response format:", railwayData);
      throw new Error('Unexpected response format from VRP API');

    } catch (error: any) {
      console.error("Step 2/3 FAILED: Railway VRP API error:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      
      // Don't re-wrap timeout errors
      if (error.message.includes('VRP-beregningen tog for lang tid')) {
        throw error;
      }
      
      throw new Error(`Railway API Error: ${error.message}`);
    }

    // Legacy code path - shouldn't reach here with worker-based API
    // Transform Railway API response to match our VrpRoutePlan interface
    console.warn("UNEXPECTED: Processing legacy response format with assignments");
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
