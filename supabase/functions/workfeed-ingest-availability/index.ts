// deno-lint-ignore-file no-explicit-any
/**
 * Supabase Edge Function: Fetch WorkFeed availability and populate supabase_availability table.
 * Stores BOTH WORK and NO_WORK type availability.
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Temporal } from "npm:@js-temporal/polyfill";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TZ = "Europe/Copenhagen";
const TABLE = "supabase_availability";
const SOURCE = "workfeed";
const DEFAULT_START = "08:30:00";
const DEFAULT_END = "16:00:00";

// ---------- Time helpers ----------
function isoToZoned(iso, timeZone) {
  return Temporal.Instant.from(iso).toZonedDateTimeISO(timeZone);
}

function plainTimeToHHMMSS(t) {
  const hh = String(t.hour).padStart(2, "0");
  const mm = String(t.minute).padStart(2, "0");
  const ss = String(t.second).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function isAllDay(start, end) {
  const sMidnight = start.hour === 0 && start.minute === 0 && start.second === 0;
  const eMidnight = end.hour === 0 && end.minute === 0 && end.second === 0;
  return sMidnight && eMidnight;
}

function splitByLocalDate(startISO, endISO, timeZone) {
  const startZ = isoToZoned(startISO, timeZone);
  const endZ = isoToZoned(endISO, timeZone);
  const startMs = Temporal.Instant.from(startISO).epochMilliseconds;
  const endMs = Temporal.Instant.from(endISO).epochMilliseconds;
  if (!(endMs > startMs)) return [];

  const slices = [];
  let cursor = startZ;

  while (true) {
    const date = cursor.toPlainDate();
    const startOfNextDay = date.add({ days: 1 }).toZonedDateTime({
      timeZone,
      plainTime: Temporal.PlainTime.from("00:00:00"),
    });
    const sliceEndZ = endZ.epochMilliseconds < startOfNextDay.epochMilliseconds ? endZ : startOfNextDay;

    slices.push({
      date,
      start: cursor.toPlainTime(),
      end: sliceEndZ.toPlainTime(),
    });

    if (sliceEndZ.equals(endZ)) break;
    cursor = sliceEndZ;
  }
  return slices;
}

// ---------- Normalize WorkFeed → per-date slices ----------
function toSlices(item) {
  const isAvailable = item.type === "WORK";
  const zonedSlices = splitByLocalDate(item.start, item.end, TZ);

  return zonedSlices.map((z) => {
    const allDay = isAllDay(z.start, z.end);
    return {
      date: z.date.toString(),
      employeeID: item.employeeID,
      isAvailable,
      type: item.type, // Keep the original type
      isAllDay: allDay,
      startLocal: plainTimeToHHMMSS(z.start),
      endLocal: plainTimeToHHMMSS(z.end),
      raw: item,
    };
  });
}

function collapseSlicesForDate(slices, inspectorMap) {
  const key = slices[0];

  // Get inspector details
  const inspector = inspectorMap.get(key.employeeID);
  if (!inspector) {
    console.warn(
      `[workfeed-ingest-availability] No inspector found for employeeID: ${key.employeeID} on date ${key.date}`,
    );
    return null;
  }

  const nowIso = new Date().toISOString();

  // Check if we have WORK or NO_WORK for this date
  const workSlices = slices.filter((s) => s.type === "WORK");
  const noWorkSlices = slices.filter((s) => s.type === "NO_WORK");

  // If there's NO_WORK, that takes precedence (inspector marked themselves unavailable)
  if (noWorkSlices.length > 0) {
    return {
      inspector_id: inspector.id,
      inspector_name: inspector.full_name,
      date_local: key.date,
      is_available: false,
      availability_status: "NOT_AVAILABLE",
      wf_type: "NO_WORK",
      start_time_local: null, // No work = no time ranges
      end_time_local: null,
      department: inspector.department_name,
      source: SOURCE,
      fetched_at: nowIso,
      wf_availability_id: noWorkSlices[0].raw.id,
      created_at_source: noWorkSlices[0].raw.createTime,
      updated_at_source: noWorkSlices[0].raw.updateTime,
      raw_payload: {
        contributing_ids: Array.from(new Set(noWorkSlices.map((s) => s.raw.id))),
        items: noWorkSlices.map((s) => s.raw),
        rationale: "Inspector marked as NO_WORK",
      },
    };
  }

  // Otherwise, process WORK slices
  if (workSlices.length === 0) {
    return null; // No data for this date
  }

  // Extract actual start and end times from the work slices
  const startTimes = workSlices.map((s) => s.startLocal).sort();
  const endTimes = workSlices.map((s) => s.endLocal).sort();

  const earliestStart = startTimes[0];
  const latestEnd = endTimes[endTimes.length - 1];

  // Check if any work slices are all-day
  const hasAllDayWork = workSlices.some((s) => s.isAllDay);

  // For all-day entries: use business hours
  const finalStartTime = hasAllDayWork ? DEFAULT_START : earliestStart;
  const finalEndTime = hasAllDayWork ? DEFAULT_END : latestEnd;

  return {
    inspector_id: inspector.id,
    inspector_name: inspector.full_name,
    date_local: key.date,
    is_available: true,
    availability_status: "AVAILABLE",
    wf_type: "WORK",
    start_time_local: finalStartTime,
    end_time_local: finalEndTime,
    department: inspector.department_name,
    source: SOURCE,
    fetched_at: nowIso,
    wf_availability_id: workSlices[0].raw.id,
    created_at_source: workSlices[0].raw.createTime,
    updated_at_source: workSlices[0].raw.updateTime,
    raw_payload: {
      contributing_ids: Array.from(new Set(workSlices.map((s) => s.raw.id))),
      items: workSlices.map((s) => s.raw),
      rationale: `Start: ${finalStartTime}, End: ${finalEndTime} (all-day: ${hasAllDayWork})`,
    },
  };
}

function groupSlices(slices) {
  const map = new Map();
  for (const s of slices) {
    const k = `${s.employeeID}|${s.date}`;
    const arr = map.get(k);
    if (arr) arr.push(s);
    else map.set(k, [s]);
  }
  return map;
}

// ---------- Fetch WorkFeed data ----------
async function fetchWorkFeedAvailability(from: string, to: string, type: string) {
  const BASE = Deno.env.get("WORKFEED_BASE_URL") ?? "https://europe-west1-production-eu-327a3.cloudfunctions.net/api";
  const COMPANY_ID = Deno.env.get("WORKFEED_COMPANY_ID") ?? "KASqUqisoJTrzapASxwG";

  const wfUrl = new URL(`${BASE}/companies/${COMPANY_ID}/availability`);
  wfUrl.searchParams.set("from", from);
  wfUrl.searchParams.set("to", to);
  wfUrl.searchParams.set("type", type);

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  const apiKey = Deno.env.get("WORKFEED_API_KEY");
  if (apiKey) {
    headers["Authorization"] = apiKey;
  } else {
    console.warn("[workfeed-ingest-availability] WORKFEED_API_KEY not set");
  }

  console.log(`[workfeed-ingest-availability] Calling WorkFeed API: ${wfUrl.toString()}`);
  const resp = await fetch(wfUrl.toString(), { headers });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`WorkFeed request failed: ${resp.status} - ${body}`);
  }

  return await resp.json();
}

// ---------- Main handler ----------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST with query params ?from&to" }), {
        status: 405,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (!from || !to) {
      return new Response(JSON.stringify({ error: "Missing required query params: from, to (ISO 8601 UTC)" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    console.log(`[workfeed-ingest-availability] Target date range: ${from} to ${to}`);

    // ADD 1 DAY PADDING
    const paddedFrom = new Date(from);
    paddedFrom.setDate(paddedFrom.getDate() - 1);
    const paddedTo = new Date(to);
    paddedTo.setDate(paddedTo.getDate() + 1);

    const paddedFromISO = paddedFrom.toISOString();
    const paddedToISO = paddedTo.toISOString();

    console.log(`[workfeed-ingest-availability] Padded fetch range: ${paddedFromISO} to ${paddedToISO}`);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // *** FETCH BOTH WORK AND NO_WORK ***
    console.log(`[workfeed-ingest-availability] Fetching WORK records...`);
    const workItems = await fetchWorkFeedAvailability(paddedFromISO, paddedToISO, "WORK");

    console.log(`[workfeed-ingest-availability] Fetching NO_WORK records...`);
    const noWorkItems = await fetchWorkFeedAvailability(paddedFromISO, paddedToISO, "NO_WORK");

    const allItems = [...workItems, ...noWorkItems];
    console.log(
      `[workfeed-ingest-availability] Received ${workItems.length} WORK + ${noWorkItems.length} NO_WORK = ${allItems.length} total items`,
    );

    // CLEAN-SLATE: Delete existing records for target date range
    const fromDate = new Date(from).toISOString().split("T")[0];
    const toDate = new Date(to).toISOString().split("T")[0];

    console.log(`[workfeed-ingest-availability] Cleaning existing records from ${fromDate} to ${toDate}`);

    const { error: deleteError } = await supabase
      .from(TABLE)
      .delete()
      .eq("source", SOURCE)
      .gte("date_local", fromDate)
      .lte("date_local", toDate);

    if (deleteError) {
      console.error("[workfeed-ingest-availability] Failed to delete existing records:", deleteError);
      return new Response(JSON.stringify({ error: "Failed to delete existing records", details: deleteError }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    if (allItems.length === 0) {
      return new Response(
        JSON.stringify({
          upserted: 0,
          message: "No availability found in WorkFeed for the specified date range",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    // Fetch inspector details
    const employeeIds = [...new Set(allItems.map((item) => item.employeeID))];
    console.log(`[workfeed-ingest-availability] Looking up ${employeeIds.length} unique employee IDs`);

    const { data: allInspectors, error: allInspectorError } = await supabase
      .from("inspectors")
      .select("id, wf_employee_id, full_name, department_id")
      .in("wf_employee_id", employeeIds)
      .eq("is_active", true);

    if (allInspectorError) {
      console.error("[workfeed-ingest-availability] Failed to fetch inspectors:", allInspectorError);
      return new Response(JSON.stringify({ error: "Failed to fetch inspectors", details: allInspectorError }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    console.log(`[workfeed-ingest-availability] Found ${allInspectors?.length || 0} active inspectors`);

    // Fetch department names
    const departmentIds = [...new Set(allInspectors?.map((i) => i.department_id).filter(Boolean) || [])];
    const { data: departments } = await supabase.from("departments").select("id, name").in("id", departmentIds);

    const departmentMap = new Map(departments?.map((d) => [d.id, d.name]) || []);

    const inspectorMap = new Map(
      allInspectors?.map((i) => [
        i.wf_employee_id,
        {
          id: i.id,
          wf_employee_id: i.wf_employee_id,
          full_name: i.full_name,
          department_name: departmentMap.get(i.department_id) || "Unknown",
        },
      ]) ?? [],
    );

    console.log(`[workfeed-ingest-availability] Mapped ${inspectorMap.size} inspectors with departments`);

    // Process all items
    const slices = allItems.flatMap(toSlices);
    const grouped = groupSlices(slices);
    const rows = [];

    for (const [, list] of grouped) {
      const row = collapseSlicesForDate(list, inspectorMap);
      if (row && row.date_local >= fromDate && row.date_local <= toDate) {
        rows.push(row);
      }
    }

    console.log(
      `[workfeed-ingest-availability] Prepared ${rows.length} rows for upsert ` +
        `(WORK: ${rows.filter((r) => r.wf_type === "WORK").length}, ` +
        `NO_WORK: ${rows.filter((r) => r.wf_type === "NO_WORK").length})`,
    );

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({
          upserted: 0,
          message: "No rows to upsert - all inspectors may be inactive or not found in database",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    // Upsert into table
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(rows, {
        onConflict: "inspector_id,date_local",
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      console.error("[workfeed-ingest-availability] Supabase upsert failed:", error);
      return new Response(JSON.stringify({ error: "Supabase upsert failed", details: error }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    console.log(`[workfeed-ingest-availability] Successfully upserted ${data?.length ?? 0} rows`);

    return new Response(
      JSON.stringify({
        upserted: data?.length ?? 0,
        work_records: rows.filter((r) => r.wf_type === "WORK").length,
        no_work_records: rows.filter((r) => r.wf_type === "NO_WORK").length,
        total_workfeed_items: allItems.length,
        unique_employees: employeeIds.length,
        mapped_inspectors: inspectorMap.size,
        rows: data,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[workfeed-ingest-availability] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Unhandled error", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
