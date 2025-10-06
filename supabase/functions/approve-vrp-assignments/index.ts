import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ApprovalRequest {
  vrp_run_id: string;
  assignments: Array<{
    inspection_id: string;
    inspector_id: string;
    inspector_name: string;
    scheduled_date: string;
    start_time: string;
    end_time: string;
    sequence_in_route: number;
    travel_from_previous_mins: number;
  }>;
  inspection_ids: string[];
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

    const { vrp_run_id, assignments, inspection_ids }: ApprovalRequest =
      await req.json();

    console.log("Approving VRP assignments:", {
      vrp_run_id,
      assignments_count: assignments.length,
      inspection_ids_count: inspection_ids.length,
    });

    // 1. Create VRP run record
    const { error: runError } = await supabase.from("vrp_runs").insert({
      id: vrp_run_id,
      inspection_ids,
      target_dates: Array.from(
        new Set(assignments.map((a) => a.scheduled_date))
      ),
      status: "COMPLETED",
      solution_json: { assignments },
      num_inspections_scheduled: assignments.length,
      total_travel_minutes: assignments.reduce(
        (sum, a) => sum + (a.travel_from_previous_mins || 0),
        0
      ),
      execution_seconds: 0,
      requested_by: "system",
    });

    if (runError) {
      throw new Error(`Failed to create VRP run: ${runError.message}`);
    }

    // 2. Insert proposed assignments
    const proposedAssignments = assignments.map((assignment) => ({
      vrp_run_id,
      inspection_id: assignment.inspection_id,
      inspector_id: assignment.inspector_id,
      scheduled_date: assignment.scheduled_date,
      start_time: assignment.start_time,
      end_time: assignment.end_time,
      sequence_in_route: assignment.sequence_in_route,
      travel_from_previous_mins: assignment.travel_from_previous_mins,
      status: "PROPOSED",
    }));

    const { error: assignmentError } = await supabase
      .from("proposed_assignments")
      .insert(proposedAssignments);

    if (assignmentError) {
      throw new Error(
        `Failed to insert proposed assignments: ${assignmentError.message}`
      );
    }

    // 3. Update inspection_queue status
    const { error: updateError } = await supabase
      .from("inspection_queue")
      .update({ status: "IN_VRP" })
      .in("id", inspection_ids);

    if (updateError) {
      throw new Error(
        `Failed to update inspection status: ${updateError.message}`
      );
    }

    console.log("VRP approval complete:", {
      vrp_run_id,
      approved_count: assignments.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        vrp_run_id,
        approved_count: assignments.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("VRP approval error:", error);
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
