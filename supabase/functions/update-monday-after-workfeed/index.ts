import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireStaff } from '../_shared/auth.ts';

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

// Convert local Danish time (Europe/Copenhagen) to UTC for Monday.com
// Denmark is UTC+1 in winter, UTC+2 in summer (DST)
function localTimeToUTC(date: string, time: string): { date: string; time: string } {
  const [year, month, day] = date.split("-").map(Number);
  const timeParts = time.split(":");
  const hours = parseInt(timeParts[0], 10);
  const minutes = parseInt(timeParts[1], 10);
  
  // Create a date object for the given local time to check DST
  // We need to determine the offset for Europe/Copenhagen on this specific date
  const testDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  
  // Use Intl to determine the timezone offset for Copenhagen on this date
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Copenhagen",
    timeZoneName: "shortOffset",
  });
  const parts = formatter.formatToParts(testDate);
  const offsetPart = parts.find((p) => p.type === "timeZoneName")?.value || "GMT+1";
  
  // Parse offset (e.g., "GMT+1" or "GMT+2")
  const offsetMatch = offsetPart.match(/GMT([+-])(\d+)/);
  let offsetHours = 1; // Default to +1 (winter time)
  if (offsetMatch) {
    const sign = offsetMatch[1] === "+" ? 1 : -1;
    offsetHours = sign * parseInt(offsetMatch[2], 10);
  }
  
  // Calculate UTC time by subtracting the offset
  let utcHours = hours - offsetHours;
  let utcDay = day;
  let utcMonth = month;
  let utcYear = year;
  
  // Handle day wraparound
  if (utcHours < 0) {
    utcHours += 24;
    utcDay -= 1;
    if (utcDay < 1) {
      utcMonth -= 1;
      if (utcMonth < 1) {
        utcMonth = 12;
        utcYear -= 1;
      }
      // Get days in previous month
      const daysInPrevMonth = new Date(utcYear, utcMonth, 0).getDate();
      utcDay = daysInPrevMonth;
    }
  } else if (utcHours >= 24) {
    utcHours -= 24;
    utcDay += 1;
    const daysInMonth = new Date(utcYear, utcMonth, 0).getDate();
    if (utcDay > daysInMonth) {
      utcDay = 1;
      utcMonth += 1;
      if (utcMonth > 12) {
        utcMonth = 1;
        utcYear += 1;
      }
    }
  }
  
  const utcDateStr = `${utcYear}-${String(utcMonth).padStart(2, "0")}-${String(utcDay).padStart(2, "0")}`;
  const utcTimeStr = `${String(utcHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
  
  return { date: utcDateStr, time: utcTimeStr };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const denied = await requireStaff(req);
  if (denied) return denied;

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

    // Convert local Danish time to UTC for Monday.com
    const utc = localTimeToUTC(normalizedDate, normalizedTime);
    console.log("[update-monday-after-workfeed] Time conversion:", {
      localDate: normalizedDate,
      localTime: normalizedTime,
      utcDate: utc.date,
      utcTime: utc.time,
    });

    // Build monday column values
    const columnValues = {
      text_mkyw2jhq: row.scheduled_inspector_name,
      date5: {
        date: utc.date,
        time: utc.time,
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
