// deno-lint-ignore-file no-explicit-any
/**
 * Supabase Edge Function: Fetch WorkFeed availability and populate supabase_availability table.
 *
 * ENV (Project Settings → Functions):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   WORKFEED_BASE_URL      (default: https://europe-west1-production-eu-327a3.cloudfunctions.net/api)
 *   WORKFEED_COMPANY_ID    (required)
 *   WORKFEED_API_KEY       (required; sent as Bearer)
 *
 * HTTP (examples):
 *   POST /workfeed-ingest-availability?from=2025-10-19T00:00:00.000Z&to=2025-10-26T00:00:00.000Z
 *   POST /workfeed-ingest-availability?from=...&to=...&employeeID=OC9C...&type=WORK
 *
 * Behavior:
 *   - Writes/updates rows in supabase_availability table (one row per employee per local date).
 *   - Upsert conflict key: (inspector_id, date_local, source).
 *   - source = 'workfeed', fetched_at = now().
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Temporal } from "npm:@js-temporal/polyfill";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TZ = "Europe/Copenhagen" as const;
const TABLE = "supabase_availability";
const SOURCE = "workfeed" as const;
const ALL_DAY_START = "08:30:00";
const ALL_DAY_END = "16:00:00";

// ---------- Types ----------

type WorkfeedAvailability = {
  id: string;
  start: string;       // ISO UTC
  end: string;         // ISO UTC
  employeeID: string;
  type: "WORK" | "NO_WORK";
  createTime: string;  // ISO UTC
  updateTime: string;  // ISO UTC
};

type Slice = {
  date: string;                 // YYYY-MM-DD (local)
  employeeID: string;
  isAvailable: boolean;         // type === "WORK"
  isAllDay: boolean;            // full local day coverage
  startLocal: string;           // HH:mm:ss local
  endLocal: string;             // HH:mm:ss local
  raw: WorkfeedAvailability;    // original item
};

type RowForUpsert = {
  inspector_id: string;
  inspector_name: string | null;
  date_local: string;             // YYYY-MM-DD
  is_available: boolean;
  start_time_local: string | null;
  end_time_local: string | null;
  department: string | null;
  source: string;                 // 'workfeed'
  fetched_at: string;             // ISO string (UTC)
  raw_payload: any;               // jsonb
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

/** Split UTC interval into per-local-date slices (timezone/DST-safe). */
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
    const startOfNextDay = date.add({ days: 1 }).toZonedDateTime({ timeZone, plainTime: Temporal.PlainTime.from("00:00:00") });
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

/**
 * Collapse multiple slices for the same (employeeID, date) into a single row according to your rules:
 *  - If any WORK slice exists that day → is_available = true (prefer WORK over NO_WORK).
 *  - If a WORK all-day slice exists → set time window to 08:30–16:00.
 *  - Else if there are WORK partial slices → merge to min(start)–max(end) times.
 *  - Else (only NO_WORK) → is_available = false, times = null.
 *  - raw_payload stores the contributing WorkFeed items for traceability.
 */
function collapseSlicesForDate(slices: Slice[]): RowForUpsert {
  const key = slices[0];
  const byType = {
    work: slices.filter((s) => s.isAvailable),
    noWork: slices.filter((s) => !s.isAvailable),
  };

  const nowIso = new Date().toISOString();

  // Prefer WORK if present
  if (byType.work.length > 0) {
    // All-day WORK?
    const hasAllDayWork = byType.work.some((s) => s.isAllDay);
    if (hasAllDayWork) {
      return {
        inspector_id: key.employeeID,
        inspector_name: null,
        date_local: key.date,
        is_available: true,
        start_time_local: ALL_DAY_START,
        end_time_local: ALL_DAY_END,
        department: null,
        source: SOURCE,
        fetched_at: nowIso,
        raw_payload: {
          contributing_ids: Array.from(new Set(byType.work.map((s) => s.raw.id))),
          items: byType.work.map((s) => s.raw),
          rationale: "Mapped ALL DAY WORK → 08:30–16:00",
        },
      };
    }

    // Merge partial WORK windows to min start / max end
    const starts = byType.work.map((s) => s.startLocal).sort();
    const ends = byType.work.map((s) => s.endLocal).sort();
    const minStart = starts[0];
    const maxEnd = ends[ends.length - 1];

    return {
      inspector_id: key.employeeID,
      inspector_name: null,
      date_local: key.date,
      is_available: true,
      start_time_local: minStart,
      end_time_local: maxEnd,
      department: null,
      source: SOURCE,
      fetched_at: nowIso,
      raw_payload: {
        contributing_ids: Array.from(new Set(byType.work.map((s) => s.raw.id))),
        items: byType.work.map((s) => s.raw),
        rationale: "Merged partial WORK windows to min–max span",
      },
    };
  }

  // Only NO_WORK slices
  return {
    inspector_id: key.employeeID,
    inspector_name: null,
    date_local: key.date,
    is_available: false,
    start_time_local: null,
    end_time_local: null,
    department: null,
    source: SOURCE,
    fetched_at: nowIso,
    raw_payload: {
      contributing_ids: Array.from(new Set(slices.map((s) => s.raw.id))),
      items: slices.map((s) => s.raw),
      rationale: "Only NO_WORK slices that day → unavailable",
    },
  };
}

// Group by (employeeID, date)
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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST with query params ?from&to[&employeeID][&type]" }), {
        status: 405,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const employeeID = url.searchParams.get("employeeID") ?? undefined;
    const type = url.searchParams.get("type") as "WORK" | "NO_WORK" | undefined;

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
      global: { headers: { "x-application-name": "workfeed-ingest-availability" } },
    });

    const BASE = Deno.env.get("WORKFEED_BASE_URL") ??
      "https://europe-west1-production-eu-327a3.cloudfunctions.net/api";
    const COMPANY_ID = Deno.env.get("WORKFEED_COMPANY_ID");
    if (!COMPANY_ID) {
      return new Response(JSON.stringify({ error: "Missing env WORKFEED_COMPANY_ID" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Build WorkFeed request
    const wfUrl = new URL(`${BASE}/companies/${COMPANY_ID}/availability`);
    wfUrl.searchParams.set("from", from);
    wfUrl.searchParams.set("to", to);
    if (employeeID) wfUrl.searchParams.set("employeeID", employeeID);
    if (type) wfUrl.searchParams.set("type", type);

    const headers: Record<string, string> = { "content-type": "application/json" };
    const apiKey = Deno.env.get("WORKFEED_API_KEY");
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
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
        status: 502, headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    const items = (await resp.json()) as WorkfeedAvailability[];
    console.log(`[workfeed-ingest-availability] Received ${items.length} availability items from WorkFeed`);

    // Normalize → slices → group → collapse → rows
    const slices: Slice[] = items.flatMap(toSlices);
    const grouped = groupSlices(slices);

    const rows: RowForUpsert[] = [];
    for (const [, list] of grouped) {
      rows.push(collapseSlicesForDate(list));
    }

    console.log(`[workfeed-ingest-availability] Prepared ${rows.length} rows for upsert`);

    if (rows.length === 0) {
      return new Response(JSON.stringify({ inserted: 0, updated: 0, message: "No availability to upsert." }), {
        status: 200, headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Upsert into your table
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(rows, { onConflict: "inspector_id,date_local,source" })
      .select();

    if (error) {
      console.error("[workfeed-ingest-availability] Supabase upsert failed:", error);
      return new Response(JSON.stringify({ error: "Supabase upsert failed", details: error }), {
        status: 500, headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    console.log(`[workfeed-ingest-availability] Successfully upserted ${data?.length ?? 0} rows`);

    return new Response(JSON.stringify({
      upserted: data?.length ?? 0,
      rows: data,
    }), { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } });
  } catch (err) {
    console.error("[workfeed-ingest-availability] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Unhandled error", details: String(err) }), {
      status: 500, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
