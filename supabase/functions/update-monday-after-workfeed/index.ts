import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BOARD_ID = "3797295927";
const MONDAY_API_URL = "https://api.monday.com/v2";

interface RequestBody {
  idx?: number;
  item_id?: number;
}

interface MondayItemRow {
  id: number;
  item_id: number | null;
  schedule_status: string | null;
  scheduled_inspector_name: string | null;
  scheduled_date: string | null;
  scheduled_start_time: string | null;
}

// Normalize time to HH:MM:SS format
function normalizeTime(time: string): string {
  if (!time) return "00:00:00";
  const parts = time.split(":");
  if (parts.length === 2) {
    return `${parts[0]}:${parts[1]}:00`;
  }
  return time;
}

// Extract date part from a timestamp if needed (YYYY-MM-DD)
function normalizeDate(date: string): string {
  if (!date) return "";
  // If it contains 'T' or space, it's a timestamp - extract date part
  if (date.includes("T")) {
    return date.split("T")[0];
  }
  if (date.includes(" ")) {
    return date.split(" ")[0];
  }
  return date;
}

// Validate date format YYYY-MM-DD
function isValidDate(date: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  return regex.test(date);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mondayToken = Deno.env.get("MONDAY_TOKEN");

    if (!mondayToken) {
      console.error("[update-monday-after-workfeed] MONDAY_TOKEN not configured");
      return new Response(
        JSON.stringify({ ok: false, error: "MONDAY_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body: RequestBody = await req.json();
    console.log("[update-monday-after-workfeed] Request body:", body);

    const { idx, item_id } = body;

    if (!idx && !item_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "Either idx or item_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Query the row - prefer idx if both provided
    let query = supabase
      .from("monday_items_selected")
      .select("id, item_id, schedule_status, scheduled_inspector_name, scheduled_date, scheduled_start_time");

    if (idx) {
      query = query.eq("id", idx);
    } else {
      query = query.eq("item_id", item_id);
    }

    const { data: rows, error: fetchError } = await query.limit(1);

    if (fetchError) {
      console.error("[update-monday-after-workfeed] Error fetching row:", fetchError);
      return new Response(
        JSON.stringify({ ok: false, error: `Database error: ${fetchError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!rows || rows.length === 0) {
      console.log("[update-monday-after-workfeed] No row found");
      return new Response(
        JSON.stringify({ ok: false, error: "Row not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const row = rows[0] as MondayItemRow;
    console.log("[update-monday-after-workfeed] Found row:", row);

    // Check schedule_status
    if (row.schedule_status !== "sent_to_workfeed") {
      console.log("[update-monday-after-workfeed] No-op: schedule_status is", row.schedule_status);
      return new Response(
        JSON.stringify({
          ok: true,
          noop: true,
          reason: `schedule_status not sent_to_workfeed (current: ${row.schedule_status})`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate item_id
    if (!row.item_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "item_id is missing from row" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate scheduled_inspector_name
    if (!row.scheduled_inspector_name || row.scheduled_inspector_name.trim() === "") {
      return new Response(
        JSON.stringify({ ok: false, error: "scheduled_inspector_name is empty" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate and normalize scheduled_date
    if (!row.scheduled_date) {
      return new Response(
        JSON.stringify({ ok: false, error: "scheduled_date is empty" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const normalizedDate = normalizeDate(row.scheduled_date);
    if (!isValidDate(normalizedDate)) {
      return new Response(
        JSON.stringify({ ok: false, error: `Invalid date format: ${row.scheduled_date}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate and normalize scheduled_start_time
    if (!row.scheduled_start_time) {
      return new Response(
        JSON.stringify({ ok: false, error: "scheduled_start_time is empty" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const normalizedTime = normalizeTime(row.scheduled_start_time);

    // Build monday column values
    const columnValues = {
      text_mkyw2jhq: row.scheduled_inspector_name,
      date5: {
        date: normalizedDate,
        time: normalizedTime,
      },
      boolean: {
        checked: "true",
      },
    };

    console.log("[update-monday-after-workfeed] Updating monday item:", {
      boardId: BOARD_ID,
      itemId: row.item_id,
      columnValues,
    });

    // Call monday.com GraphQL API
    const mutation = `
      mutation ($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
        change_multiple_column_values(
          board_id: $boardId
          item_id: $itemId
          column_values: $columnValues
        ) { id }
      }
    `;

    const mondayResponse = await fetch(MONDAY_API_URL, {
      method: "POST",
      headers: {
        Authorization: mondayToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          boardId: BOARD_ID,
          itemId: String(row.item_id),
          columnValues: JSON.stringify(columnValues),
        },
      }),
    });

    const mondayResult = await mondayResponse.json();
    console.log("[update-monday-after-workfeed] Monday API response:", mondayResult);

    // Check for GraphQL errors
    if (mondayResult.errors && mondayResult.errors.length > 0) {
      const errorMsg = mondayResult.errors.map((e: any) => e.message).join(", ");
      console.error("[update-monday-after-workfeed] Monday GraphQL errors:", errorMsg);
      return new Response(
        JSON.stringify({ ok: false, error: `Monday API error: ${errorMsg}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for data errors
    if (!mondayResult.data?.change_multiple_column_values?.id) {
      console.error("[update-monday-after-workfeed] Monday API did not return expected data:", mondayResult);
      return new Response(
        JSON.stringify({ ok: false, error: "Monday API did not return expected response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[update-monday-after-workfeed] Monday update successful, updating Supabase row");

    // Update Supabase row to prevent duplicates
    const { error: updateError } = await supabase
      .from("monday_items_selected")
      .update({
        schedule_status: "scheduled_in_monday",
        scheduled_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updateError) {
      console.error("[update-monday-after-workfeed] Error updating Supabase row:", updateError);
      // Monday was updated successfully, so we return partial success
      return new Response(
        JSON.stringify({
          ok: true,
          warning: `Monday updated but Supabase update failed: ${updateError.message}`,
          item_id: row.item_id,
          board_id: BOARD_ID,
          updated: columnValues,
          new_status: "scheduled_in_monday (update failed)",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[update-monday-after-workfeed] Success for item_id:", row.item_id);

    return new Response(
      JSON.stringify({
        ok: true,
        item_id: row.item_id,
        board_id: BOARD_ID,
        updated: columnValues,
        new_status: "scheduled_in_monday",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[update-monday-after-workfeed] Unexpected error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: `Unexpected error: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
