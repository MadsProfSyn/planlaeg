// deno-lint-ignore-file no-explicit-any
/**
 * Supabase Edge Function: Fetch WorkFeed availability and populate supabase_availability table.
 * Stores both WORK (available) and NO_WORK (unavailable) types from WorkFeed.
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
const DEFAULT_START = "08:30:00"; // Business hours start for all-day availability
const DEFAULT_END = "16:00:00"; // Business hours end for all-day availability

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
    const startOfNextDay = date
      .add({
        days: 1,
      })
      .toZonedDateTime({
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

  // Determine final availability status:
  // If ANY WORK slice exists → Available (true)
  // If ONLY NO_WORK slices exist → Unavailable (false)
  const hasWorkSlice = slices.some((s) => s.isAvailable);
  const finalIsAvailable = hasWorkSlice;
  
  // For time ranges, use WORK slices if available, otherwise use NO_WORK slices
  const relevantSlices = hasWorkSlice ? slices.filter((s) => s.isAvailable) : slices;

  const nowIso = new Date().toISOString();

  // Extract actual start and end times from the relevant slices
  const startTimes = relevantSlices.map((s) => s.startLocal).sort();
  const endTimes = relevantSlices.map((s) => s.endLocal).sort();

  const earliestStart = startTimes[0]; // Earliest start time
  const latestEnd = endTimes[endTimes.length - 1]; // Latest end time

  // Check if any relevant slices are all-day (midnight to midnight)
  const hasAllDay = relevantSlices.some((s) => s.isAllDay);

  // If all-day, use business hours; otherwise use actual times
  const finalStartLocal = hasAllDay ? DEFAULT_START : earliestStart;
  const finalEndLocal = hasAllDay ? DEFAULT_END : latestEnd;

  return {
    inspector_id: inspector.id,
    inspector_name: inspector.full_name,
    date_local: key.date,
    is_available: finalIsAvailable, // true for WORK, false for NO_WORK
    start_time_local: finalStartLocal,
    end_time_local: finalEndLocal,
    department: inspector.department_name,
    source: SOURCE,
    fetched_at: nowIso,
    raw_payload: {
      contributing_ids: Array.from(new Set(relevantSlices.map((s) => s.raw.id))),
      items: relevantSlices.map((s) => s.raw),
      rationale: `Start: ${finalStartLocal}, End: ${finalEndLocal} (all-day: ${hasAllDay}). Status: ${finalIsAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}`,
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

// ---------- Main handler ----------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          error: "Use POST with query params ?from&to",
        }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "content-type": "application/json",
          },
        },
      );
    }

    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (!from || !to) {
      return new Response(
        JSON.stringify({
          error: "Missing required query params: from, to (ISO 8601 UTC)",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "content-type": "application/json",
          },
        },
      );
    }

    console.log(`[workfeed-ingest-availability] Target date range: ${from} to ${to}`);

    // ADD 1 DAY PADDING for WorkFeed API query (to catch midnight-boundary entries)
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
      return new Response(
        JSON.stringify({
          error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "content-type": "application/json",
          },
        },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
      },
    });

    const BASE = Deno.env.get("WORKFEED_BASE_URL") ?? "https://europe-west1-production-eu-327a3.cloudfunctions.net/api";
    const COMPANY_ID = Deno.env.get("WORKFEED_COMPANY_ID") ?? "KASqUqisoJTrzapASxwG";

    // Build WorkFeed request with PADDED dates - FETCH ALL TYPES (WORK and NO_WORK)
    const wfUrl = new URL(`${BASE}/companies/${COMPANY_ID}/availability`);
    wfUrl.searchParams.set("from", paddedFromISO);
    wfUrl.searchParams.set("to", paddedToISO);
    // Removed type filter to capture both WORK and NO_WORK

    const headers = {
      "content-type": "application/json",
    };
    const apiKey = Deno.env.get("WORKFEED_API_KEY");
    if (apiKey) {
      headers["Authorization"] = apiKey;
    } else {
      console.warn("[workfeed-ingest-availability] WORKFEED_API_KEY not set");
    }

    // Fetch WorkFeed with padded range
    console.log(`[workfeed-ingest-availability] Calling WorkFeed API: ${wfUrl.toString()}`);
    const resp = await fetch(wfUrl.toString(), {
      headers,
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error(`[workfeed-ingest-availability] WorkFeed request failed: ${resp.status} - ${body}`);
      return new Response(
        JSON.stringify({
          error: "WorkFeed request failed",
          status: resp.status,
          body,
        }),
        {
          status: 502,
          headers: {
            ...corsHeaders,
            "content-type": "application/json",
          },
        },
      );
    }

    const items = await resp.json();
    console.log(`[workfeed-ingest-availability] Received ${items.length} WORK availability items from WorkFeed (padded range)`);

    // CLEAN-SLATE: Delete existing records ONLY for the TARGET date range (not padded)
    const fromDate = new Date(from).toISOString().split("T")[0];
    const toDate = new Date(to).toISOString().split("T")[0];

    console.log(
      `[workfeed-ingest-availability] Cleaning existing records from ${fromDate} to ${toDate} (target range only)`,
    );

    const { error: deleteError } = await supabase
      .from(TABLE)
      .delete()
      .eq("source", SOURCE)
      .gte("date_local", fromDate)  // Use original dates
      .lte("date_local", toDate);    // Use original dates

    if (deleteError) {
      console.error("[workfeed-ingest-availability] Failed to delete existing records:", deleteError);
      return new Response(
        JSON.stringify({
          error: "Failed to delete existing records",
          details: deleteError,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "content-type": "application/json",
          },
        },
      );
    }

    console.log(`[workfeed-ingest-availability] Successfully cleaned existing records for target date range`);

    if (items.length === 0) {
      return new Response(
        JSON.stringify({
          upserted: 0,
          message: "No WORK availability found in WorkFeed for the specified date range",
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "content-type": "application/json",
          },
        },
      );
    }

    // Extract unique employee IDs and fetch inspector details
    const employeeIds = [...new Set(items.map((item) => item.employeeID))];
    console.log(`[workfeed-ingest-availability] Looking up ${employeeIds.length} unique employee IDs`);

    // Fetch ALL inspectors first
    const { data: allInspectors, error: allInspectorError } = await supabase
      .from("inspectors")
      .select("id, wf_employee_id, full_name, department_id")
      .in("wf_employee_id", employeeIds)
      .eq("is_active", true);

    if (allInspectorError) {
      console.error("[workfeed-ingest-availability] Failed to fetch inspectors:", allInspectorError);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch inspectors",
          details: allInspectorError,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "content-type": "application/json",
          },
        },
      );
    }

    console.log(`[workfeed-ingest-availability] Found ${allInspectors?.length || 0} active inspectors`);

    // Fetch department names for all department IDs
    const departmentIds = [...new Set(allInspectors?.map((i) => i.department_id).filter(Boolean) || [])];
    const { data: departments } = await supabase.from("departments").select("id, name").in("id", departmentIds);

    const departmentMap = new Map(departments?.map((d) => [d.id, d.name]) || []);

    // Create lookup map with department names
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

    // Normalize → slices → group → collapse → rows
    const slices = items.flatMap(toSlices);
    const grouped = groupSlices(slices);
    const rows = [];

    for (const [, list] of grouped) {
      const row = collapseSlicesForDate(list, inspectorMap);
      if (row) {
        // FILTER: Only include rows within the TARGET date range (not padded days)
        if (row.date_local >= fromDate && row.date_local <= toDate) {
          rows.push(row);
        }
      }
    }

    console.log(`[workfeed-ingest-availability] Prepared ${rows.length} rows for upsert (WORK only, filtered to target range)`);

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({
          upserted: 0,
          message: "No rows to upsert - all inspectors may be inactive or not found in database",
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "content-type": "application/json",
          },
        },
      );
    }

    // Upsert into table
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(rows, {
        onConflict: "inspector_id,date_local,source",
      })
      .select();

    if (error) {
      console.error("[workfeed-ingest-availability] Supabase upsert failed:", error);
      return new Response(
        JSON.stringify({
          error: "Supabase upsert failed",
          details: error,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "content-type": "application/json",
          },
        },
      );
    }

    console.log(`[workfeed-ingest-availability] Successfully upserted ${data?.length ?? 0} rows`);

    return new Response(
      JSON.stringify({
        upserted: data?.length ?? 0,
        total_workfeed_items: items.length,
        unique_employees: employeeIds.length,
        mapped_inspectors: inspectorMap.size,
        rows: data,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "content-type": "application/json",
        },
      },
    );
  } catch (err) {
    console.error("[workfeed-ingest-availability] Unhandled error:", err);
    return new Response(
      JSON.stringify({
        error: "Unhandled error",
        details: String(err),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "content-type": "application/json",
        },
      },
    );
  }
});
