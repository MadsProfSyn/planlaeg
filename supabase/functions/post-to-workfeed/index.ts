import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WORKFEED_API_URL = "https://europe-west1-production-eu-327a3.cloudfunctions.net/api";
const WORKFEED_API_KEY = Deno.env.get("WORKFEED_API_KEY") ?? "";
const WORKFEED_COMPANY_ID = Deno.env.get("WORKFEED_COMPANY_ID") ?? "";

interface PostWorkfeedRequest {
  shiftId: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { shiftId }: PostWorkfeedRequest = await req.json();

    console.log(`[post-to-workfeed] Processing shift: ${shiftId}`);

    // 1. Get shift data
    const { data: shift, error: shiftError } = await supabase
      .from("supabase_shifts")
      .select("*")
      .eq("id", shiftId)
      .single();

    if (shiftError || !shift) {
      throw new Error(`Shift not found: ${shiftError?.message}`);
    }

    console.log(`[post-to-workfeed] Shift data:`, {
      inspector: shift.inspector_name,
      date: shift.date_local,
      type: shift.type,
    });

    // 2. Get WorkFeed role ID from inspection type
    const { data: roleID, error: roleError } = await supabase.rpc(
      "get_wf_role_id_for_inspection",
      {
        p_inspection_type: shift.type,
      }
    );

    if (roleError || !roleID) {
      throw new Error(`Role ID not found for type: ${shift.type} - ${roleError?.message}`);
    }

    console.log(`[post-to-workfeed] Role ID: ${roleID}`);

    // 3. Convert local time to UTC (Copenhagen = UTC+1 in winter, UTC+2 in summer)
    // We assume the times in DB are already in local Copenhagen time
    const startUTC = new Date(`${shift.date_local}T${shift.start_time_local}+01:00`).toISOString();
    const endUTC = new Date(`${shift.date_local}T${shift.end_time_local}+01:00`).toISOString();

    console.log(`[post-to-workfeed] Time conversion:`, {
      local_start: `${shift.date_local}T${shift.start_time_local}`,
      local_end: `${shift.date_local}T${shift.end_time_local}`,
      utc_start: startUTC,
      utc_end: endUTC,
    });

    // 4. POST to WorkFeed
    const workfeedPayload = {
      roleID: roleID,
      start: startUTC,
      end: endUTC,
      employeeID: shift.wf_employee_id,
      released: true,
      comment: shift.address || "",
    };

    console.log(`[post-to-workfeed] POSTing to WorkFeed:`, workfeedPayload);

    const workfeedResponse = await fetch(
      `${WORKFEED_API_URL}/companies/${WORKFEED_COMPANY_ID}/shifts`,
      {
        method: "POST",
        headers: {
          Authorization: WORKFEED_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(workfeedPayload),
      }
    );

    if (!workfeedResponse.ok) {
      const errorText = await workfeedResponse.text();
      throw new Error(`WorkFeed API error (${workfeedResponse.status}): ${errorText}`);
    }

    const result = await workfeedResponse.json();
    console.log(`[post-to-workfeed] WorkFeed response:`, result);

    // 5. Update shift with WorkFeed ID and mark as synced
    const { error: updateError } = await supabase
      .from("supabase_shifts")
      .update({
        wf_shift_id: result.id,
        sync_status: "synced",
        status: "ASSIGNED",
        start_utc: startUTC,
        end_utc: endUTC,
        sync_attempts: shift.sync_attempts + 1,
        last_sync_attempt: new Date().toISOString(),
      })
      .eq("id", shiftId);

    if (updateError) {
      console.error(`[post-to-workfeed] Failed to update shift:`, updateError);
      throw new Error(`Failed to update shift: ${updateError.message}`);
    }

    console.log(`[post-to-workfeed] ✅ Successfully synced shift ${shiftId} to WorkFeed`);

    return new Response(
      JSON.stringify({
        success: true,
        wf_shift_id: result.id,
        shift_id: shiftId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error(`[post-to-workfeed] ❌ Error:`, error);

    // Log error to shift (best effort)
    try {
      const { shiftId } = await req.json();
      await supabase
        .from("supabase_shifts")
        .update({
          sync_status: "sync_failed",
          sync_error: error.message,
          sync_attempts: supabase.from("supabase_shifts").select("sync_attempts").eq("id", shiftId).single().then(r => (r.data?.sync_attempts ?? 0) + 1),
          last_sync_attempt: new Date().toISOString(),
        })
        .eq("id", shiftId);
    } catch (updateErr) {
      console.error(`[post-to-workfeed] Failed to log error to DB:`, updateErr);
    }

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
