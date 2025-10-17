// deno-lint-ignore-file no-explicit-any
/**
 * Supabase Edge Function: Fetch WorkFeed availability and populate supabase_availability table.
 * ONLY stores WORK type availability (not NO_WORK).
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Temporal } from "npm:@js-temporal/polyfill";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TZ = "Europe/Copenhagen" as const;
const TABLE = "supabase_availability";
const SOURCE = "workfeed" as const;
const ALL_DAY_START = "08:30:00";
const ALL_DAY_END = "16:00:00";

// ---------- Types ----------

type WorkfeedAvailability = {
  id: string;
  start: string; // ISO UTC
  end: string; // ISO UTC
  employeeID: string;
  type: "WORK" | "NO_WORK";
  createTime: string;
  updateTime: string;
};

type Inspector = {
  id: string;
  wf_employee_id: string;
  full_name: string;
  department_name: string; // Joined from departments table
};

type Slice = {
  date: string;
  employeeID: string;
  isAvailable: boolean;
  isAllDay: boolean;
  startLocal: string;
  endLocal: string;
  raw: WorkfeedAvailability;
};

type RowForUpsert = {
  inspector_id: string;
  inspector_name: string;
  date_local: string;
  is_available: boolean;
  start_time_local: string | null;
  end_time_local: string | null;
  department: string;
  source: string;
  fetched_at: string;
  raw_payload: any;
};

// ---------- Time helpers ----------

function isoToZoned(iso: string, timeZone: string) {
  return Temporal.Instant.from(iso).toZonedDateTimeISO(timeZone);
}

function plainTimeToHHMMSS(t: Temporal.PlainTime): string {
  const hh = String(t.hour).padStart(2, "0");
  const mm = String(t.minute).padStart(2, "0");
  const ss = String(t.second).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function isAllDay(start: Temporal.PlainTime, end: Temporal.PlainTime): boolean {
  const sMidnight = start.hour === 0 && start.minute === 0 && start.second === 0;
  const eMidnight = end.hour === 0 && end.minute === 0 && end.second === 0;
  return sMidnight && eMidnight;
}

function splitByLocalDate(
  startISO: string,
  endISO: string,
  timeZone: string,
): Array<{ date: Temporal.PlainDate; start: Temporal.PlainTime; end: Temporal.PlainTime }> {
  const startZ = isoToZoned(startISO, timeZone);
  const endZ = isoToZoned(endISO, timeZone);

  const startMs = Temporal.Instant.from(startISO).epochMilliseconds;
  const endMs = Temporal.Instant.from(endISO).epochMilliseconds;
  if (!(endMs > startMs)) return [];

  const slices: Array<{ date: Temporal.PlainDate; start: Temporal.PlainTime; end: Temporal.PlainTime }> = [];

  let cursor = startZ;
  while (true) {
    const date = cursor.toPlainDate();
    const startOfNextDay = date
      .add({ days: 1 })
      .toZonedDateTime({ timeZone, plainTime: Temporal.PlainTime.from("00:00:00") });
    const sliceEndZ = endZ.epochMilliseconds < startOfNextDay.epochMilliseconds ? endZ : startOfNextDay;

    slices.push({ date, start: cursor.toPlainTime(), end: sliceEndZ.toPlainTime() });

    if (sliceEndZ.equals(endZ)) break;
    cursor = sliceEndZ;
  }

  return slices;
}

// ---------- Normalize WorkFeed → per-date slices ----------

function toSlices(item: WorkfeedAvailability): Slice[] {
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

function collapseSlicesForDate(slices: Slice[], inspectorMap: Map<string, Inspector>): RowForUpsert | null {
  const key = slices[0];

  // Get inspector details
  const inspector = inspectorMap.get(key.employeeID);
  if (!inspector) {
    console.warn(
      `[workfeed-ingest-availability] No inspector found for employeeID: ${key.employeeID} on date ${key.date}`,
    );
    return null;
  }

  // ONLY PROCESS WORK SLICES
  const workSlices = slices.filter((s) => s.isAvailable);
  if (workSlices.length === 0) {
    // Skip NO_WORK only records
    return null;
  }

  const nowIso = new Date().toISOString();

  // Check if all-day WORK
  const hasAllDayWork = workSlices.some((s) => s.isAllDay);
  if (hasAllDayWork) {
    return {
      inspector_id: inspector.id,
      inspector_name: inspector.full_name,
      date_local: key.date,
      is_available: true,
      start_time_local: ALL_DAY_START,
      end_time_local: ALL_DAY_END,
      department: inspector.department_name,
      source: SOURCE,
      fetched_at: nowIso,
      raw_payload: {
        contributing_ids: Array.from(new Set(workSlices.map((s) => s.raw.id))),
        items: workSlices.map((s) => s.raw),
        rationale: "Mapped ALL DAY WORK → 08:30–16:00",
      },
    };
  }

  // Merge partial WORK windows to min start / max end
  const starts = workSlices.map((s) => s.startLocal).sort();
  const ends = workSlices.map((s) => s.endLocal).sort();
  const minStart = starts[0];
  const maxEnd = ends[ends.length - 1];

  return {
    inspector_id: inspector.id,
    inspector_name: inspector.full_name,
    date_local: key.date,
    is_available: true,
    start_time_local: minStart,
    end_time_local: maxEnd,
    department: inspector.department_name,
    source: SOURCE,
    fetched_at: nowIso,
    raw_payload: {
      contributing_ids: Array.from(new Set(workSlices.map((s) => s.raw.id))),
      items: workSlices.map((s) => s.raw),
      rationale: "Merged partial WORK windows to min–max span",
    },
  };
}

function groupSlices(slices: Slice[]): Map<string, Slice[]> {
  const map = new Map<string, Slice[]>();
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

    console.log(`[workfeed-ingest-availability] Fetching from ${from} to ${to}`);

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

    const BASE = Deno.env.get("WORKFEED_BASE_URL") ?? "https://europe-west1-production-eu-327a3.cloudfunctions.net/api";
    const COMPANY_ID = Deno.env.get("WORKFEED_COMPANY_ID") ?? "KASqUqisoJTrzapASxwG";

    // Build WorkFeed request - ONLY FETCH WORK TYPE
    const wfUrl = new URL(`${BASE}/companies/${COMPANY_ID}/availability`);
    wfUrl.searchParams.set("from", from);
    wfUrl.searchParams.set("to", to);
    wfUrl.searchParams.set("type", "WORK"); // ONLY FETCH WORK AVAILABILITY

    const headers: Record<string, string> = { "content-type": "application/json" };
    const apiKey = Deno.env.get("WORKFEED_API_KEY");
    if (apiKey) {
      headers["Authorization"] = apiKey;
    } else {
      console.warn("[workfeed-ingest-availability] WORKFEED_API_KEY not set");
    }

    // Fetch WorkFeed
    console.log(`[workfeed-ingest-availability] Calling WorkFeed API: ${wfUrl.toString()}`);
    const resp = await fetch(wfUrl.toString(), { headers });
    if (!resp.ok) {
      const body = await resp.text();
      console.error(`[workfeed-ingest-availability] WorkFeed request failed: ${resp.status} - ${body}`);
      return new Response(JSON.stringify({ error: "WorkFeed request failed", status: resp.status, body }), {
        status: 502,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    const items = (await resp.json()) as WorkfeedAvailability[];
    console.log(`[workfeed-ingest-availability] Received ${items.length} WORK availability items from WorkFeed`);

    // Extract unique employee IDs and fetch inspector details with JOIN to departments
    const employeeIds = [...new Set(items.map((item) => item.employeeID))];
    console.log(`[workfeed-ingest-availability] Looking up ${employeeIds.length} unique employee IDs`);

    // Join with departments table to get department name
    const { data: inspectors, error: inspectorError } = await supabase
      .from("inspectors")
      .select(
        `
        id,
        wf_employee_id,
        full_name,
        departments!inner(name)
      `,
      )
      .in("wf_employee_id", employeeIds)
      .eq("is_active", true);

    if (inspectorError) {
      console.error("[workfeed-ingest-availability] Failed to fetch inspector mappings:", inspectorError);
      return new Response(JSON.stringify({ error: "Failed to fetch inspector mappings", details: inspectorError }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Create lookup map: wf_employee_id → Inspector object
    const inspectorMap = new Map<string, Inspector>(
      inspectors?.map((i) => [
        i.wf_employee_id,
        {
          id: i.id,
          wf_employee_id: i.wf_employee_id,
          full_name: i.full_name,
          department_name: i.departments?.name || "Unknown",
        },
      ]) ?? [],
    );
    console.log(`[workfeed-ingest-availability] Mapped ${inspectorMap.size} active inspectors`);

    // Normalize → slices → group → collapse → rows
    const slices: Slice[] = items.flatMap(toSlices);
    const grouped = groupSlices(slices);

    const rows: RowForUpsert[] = [];
    for (const [, list] of grouped) {
      const row = collapseSlicesForDate(list, inspectorMap);
      if (row) {
        rows.push(row);
      }
    }

    console.log(`[workfeed-ingest-availability] Prepared ${rows.length} rows for upsert (WORK only)`);

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({
          upserted: 0,
          message: "No WORK availability to upsert (either no data or all inspectors inactive/unmapped)",
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
      .upsert(rows, { onConflict: "inspector_id,date_local,source" })
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
        rows: data,
      }),
      { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  } catch (err) {
    console.error("[workfeed-ingest-availability] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Unhandled error", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
