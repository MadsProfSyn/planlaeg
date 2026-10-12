import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { requireStaff } from '../_shared/auth.ts';

// 2026-10-07: Vagterne hentes, geokodes og skrives nu i ét hug (RPC replace_shifts_window),
// så bookede vagter ikke forsvinder i planlæggeren mens synkroniseringen kører.
// Adresser slås op i cachen samlet i stedet for én ad gangen (fra ~90 sek. til få sekunder).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Convert UTC timestamp to Copenhagen local time
function toCopenhagenTime(utcDateTimeStr) {
  const date = new Date(utcDateTimeStr);
  const copenhagenStr = date.toLocaleString("en-US", {
    timeZone: "Europe/Copenhagen",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return copenhagenStr.split(", ")[1] || copenhagenStr;
}

// Calculate duration in minutes between two UTC timestamps
function calculateDuration(startUtc, endUtc) {
  const start = new Date(startUtc);
  const end = new Date(endUtc);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
}

// Extract address from comment message (first line)
function extractAddress(comment) {
  if (!comment || !comment.message) return null;
  const firstLine = comment.message.split("\n")[0].trim();
  if (firstLine.length > 5) {
    return firstLine;
  }
  return null;
}

// Normalize address for cache lookup
function normalizeAddress(address: string): string {
  return `${stripFloorDoor(address).toLowerCase().trim()}, danmark`;
}
function rawNormalizeAddress(address: string): string {
  return `${address.toLowerCase().trim()}, danmark`;
}

// Removes Danish floor/door segments like ", 1. 11" / ", 6. th" / ", st. tv" / ", 2. sal" / ", 3. mf"
function stripFloorDoor(address: string): string {
  return address
    .replace(/,\s*(st\.?|kl\.?|\d+\.?)\s*(tv|th|mf|mid|sal|\.?\s*\d+)?(?=,|$)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

type GeocodeOutcome =
  | { status: "success"; lat: number; lng: number; source: "cache" | "mapbox" }
  | { status: "failed"; reason: string }
  | { status: "no_address" };

type CacheMap = Map<string, { lat: number; lon: number }>;

// Hent alle relevante cache-nøgler i få kald (i stedet for 2 kald pr. vagt)
async function loadCoordsCache(
  supabase: ReturnType<typeof createClient>,
  addresses: string[],
): Promise<CacheMap> {
  const keys = new Set<string>();
  for (const a of addresses) {
    keys.add(rawNormalizeAddress(a));
    keys.add(normalizeAddress(a));
  }
  const all = [...keys];
  const cache: CacheMap = new Map();
  const CHUNK = 50;
  for (let i = 0; i < all.length; i += CHUNK) {
    const chunk = all.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("mapbox_coords_cache")
      .select("normalized_address, lat, lon")
      .in("normalized_address", chunk);
    if (error) {
      console.warn(`Cache lookup failed for chunk ${i / CHUNK}: ${error.message}`);
      continue;
    }
    for (const r of data || []) {
      if (r.lat && r.lon) cache.set(r.normalized_address, { lat: r.lat, lon: r.lon });
    }
  }
  return cache;
}

// Geocode an address using Mapbox with caching.
// If a preloaded cache map is given it is used first; otherwise the database cache is queried.
async function geocodeAddress(
  supabase: ReturnType<typeof createClient>,
  address: string | null,
  mapboxToken: string,
  preloaded?: CacheMap,
): Promise<GeocodeOutcome> {
  if (!address) return { status: "no_address" };

  const rawKey = rawNormalizeAddress(address);
  const strippedKey = normalizeAddress(address);
  const keysToTry = rawKey === strippedKey ? [rawKey] : [rawKey, strippedKey];

  // Cache-first under BOTH conventions: legacy (raw, floor/door intact) then stripped.
  for (const key of keysToTry) {
    if (preloaded) {
      const hit = preloaded.get(key);
      if (hit) return { status: "success", lat: hit.lat, lng: hit.lon, source: "cache" };
      continue;
    }
    const { data: cached } = await supabase
      .from("mapbox_coords_cache")
      .select("lat, lon")
      .eq("normalized_address", key)
      .maybeSingle();
    if (cached?.lat && cached?.lon) {
      return { status: "success", lat: cached.lat, lng: cached.lon, source: "cache" };
    }
  }
  const normalizedAddress = strippedKey;

  // Call Mapbox on miss
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(normalizedAddress)}.json?access_token=${mapboxToken}&country=DK&limit=1`;
    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.text();
      console.warn(`Mapbox HTTP ${response.status} for "${normalizedAddress}": ${body.slice(0, 200)}`);
      return { status: "failed", reason: `mapbox_http_${response.status}` };
    }
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;

      // Write back under BOTH keys so future lookups from either convention hit.
      const now = new Date().toISOString();
      const rows = rawKey === strippedKey
        ? [{ normalized_address: strippedKey, lat, lon: lng, updated_at: now }]
        : [
            { normalized_address: strippedKey, lat, lon: lng, updated_at: now },
            { normalized_address: rawKey, lat, lon: lng, updated_at: now },
          ];
      await supabase.from("mapbox_coords_cache").upsert(rows, { onConflict: "normalized_address" });
      if (preloaded) {
        for (const r of rows) preloaded.set(r.normalized_address, { lat, lon: lng });
      }

      return { status: "success", lat, lng, source: "mapbox" };
    }

    console.warn(`Mapbox returned 0 features for "${normalizedAddress}"`);
    return { status: "failed", reason: "no_features" };
  } catch (error) {
    console.error(`Geocoding error for "${address}":`, error);
    return { status: "failed", reason: "exception" };
  }
}

export { geocodeAddress, normalizeAddress };

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const denied = await requireStaff(req);
  if (denied) return denied;

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { startDate, endDate } = await req.json().catch(() => ({}));

    // Default to today + 90 days ahead
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const ninetyDaysLater = new Date();
    ninetyDaysLater.setDate(ninetyDaysLater.getDate() + 90);
    const defaultEndDate = ninetyDaysLater.toISOString().split("T")[0];

    const fromDate = startDate || todayStr;
    const toDate = endDate || defaultEndDate;

    console.log(`Syncing shifts for ${fromDate} to ${toDate} (atomic replace)`);

    // Build inspector lookup map
    const { data: inspectors, error: inspectorsError } = await supabaseClient
      .from("inspectors")
      .select("id, full_name, wf_employee_id")
      .not("wf_employee_id", "is", null);

    if (inspectorsError) {
      throw new Error(`Failed to load inspectors: ${inspectorsError.message}`);
    }

    const inspectorMap = new Map();
    for (const inspector of inspectors || []) {
      inspectorMap.set(inspector.wf_employee_id, {
        id: inspector.id,
        name: inspector.full_name,
      });
    }

    // Load department mappings
    const { data: departments } = await supabaseClient.from("departments").select("wf_department_id, name");
    const departmentMap = new Map();
    for (const dept of departments || []) {
      departmentMap.set(dept.wf_department_id, dept.name);
    }

    // Load role mappings
    const { data: roleMappings } = await supabaseClient.from("role_mappings").select("wf_role_id, wf_role_name");
    const roleMap = new Map();
    for (const role of roleMappings || []) {
      roleMap.set(role.wf_role_id, role.wf_role_name);
    }
    console.log(`Loaded ${inspectorMap.size} inspectors, ${departmentMap.size} departments, ${roleMap.size} roles`);

    // Fetch shifts from Workfeed API
    const workfeedApiKey = Deno.env.get("WORKFEED_API_KEY");
    const workfeedCompanyId = Deno.env.get("WORKFEED_COMPANY_ID") || "KASqUqisoJTrzapASxwG";

    if (!workfeedApiKey) {
      throw new Error("WORKFEED_API_KEY is not configured");
    }

    const mapboxToken = Deno.env.get("MAPBOX_TOKEN");
    if (!mapboxToken) {
      console.error("MAPBOX_TOKEN missing at runtime — aborting sync to avoid silent null-fill");
      throw new Error("MAPBOX_TOKEN is not configured");
    }

    const startFromISO = `${fromDate}T00:00:00.000Z`;
    const startToISO = `${toDate}T23:59:59.999Z`;

    const workfeedUrl = `https://europe-west1-production-eu-327a3.cloudfunctions.net/api/companies/${workfeedCompanyId}/shifts?startFrom=${startFromISO}&startTo=${startToISO}`;

    console.log("Fetching from Workfeed:", workfeedUrl);

    const workfeedResponse = await fetch(workfeedUrl, {
      method: "GET",
      headers: {
        Authorization: workfeedApiKey,
        "Content-Type": "application/json",
      },
    });

    if (!workfeedResponse.ok) {
      throw new Error(`Workfeed API error: ${workfeedResponse.status} ${workfeedResponse.statusText}`);
    }

    const workfeedData = await workfeedResponse.json();
    if (!Array.isArray(workfeedData)) {
      // Afbryd uden at røre eksisterende vagter, hvis WorkFeed svarer med noget uventet
      throw new Error(`Unexpected WorkFeed response (not an array)`);
    }
    console.log(`Received ${workfeedData.length} shifts from Workfeed`);

    // Preload coordinates cache for all addresses in one go
    const allAddresses = workfeedData
      .map((s) => extractAddress(s.comment))
      .filter((a): a is string => !!a);
    const coordsCache = await loadCoordsCache(supabaseClient, allAddresses);
    console.log(`Preloaded ${coordsCache.size} cached coordinates for ${allAddresses.length} addresses`);

    let unmapped = 0;
    let errors = 0;
    let addressesExtracted = 0;
    let geocoded = 0;
    let geocodeFailed = 0;
    let noAddress = 0;
    let mapboxCalls = 0;

    const rowsById = new Map<string, Record<string, unknown>>();

    for (const shift of workfeedData) {
      try {
        if (!shift.employeeID) {
          unmapped++;
          continue;
        }

        const inspector = inspectorMap.get(shift.employeeID);
        if (!inspector) {
          console.warn(`No inspector found for wf_employee_id: ${shift.employeeID} (shift: ${shift.id})`);
          unmapped++;
          continue;
        }

        let startTimeLocal = null;
        let endTimeLocal = null;
        let duration = null;

        if (shift.start && shift.end) {
          try {
            startTimeLocal = toCopenhagenTime(shift.start);
            endTimeLocal = toCopenhagenTime(shift.end);
            duration = calculateDuration(shift.start, shift.end);
          } catch (timeError) {
            console.error("Error converting times:", timeError);
          }
        }

        const dateLocal = shift.start ? shift.start.split("T")[0] : fromDate;
        const departmentName = departmentMap.get(shift.departmentID) || "Unknown";
        const roleAbbreviation = roleMap.get(shift.roleID) || "Unknown";

        const address = extractAddress(shift.comment);
        if (address) addressesExtracted++;

        const outcome = await geocodeAddress(supabaseClient, address, mapboxToken, coordsCache);
        let lat: number | null = null;
        let lng: number | null = null;
        let geocodeStatus: "success" | "failed" | "no_address" = "no_address";
        if (outcome.status === "success") {
          lat = outcome.lat;
          lng = outcome.lng;
          geocodeStatus = "success";
          geocoded++;
          if (outcome.source === "mapbox") {
            mapboxCalls++;
            await new Promise((resolve) => setTimeout(resolve, 100)); // rate-limit only real Mapbox calls
          }
        } else if (outcome.status === "failed") {
          geocodeStatus = "failed";
          geocodeFailed++;
          console.warn(`Shift ${shift.id} geocode failed (${outcome.reason}) for "${address}"`);
        } else {
          noAddress++;
        }

        rowsById.set(shift.id, {
          wf_shift_id: shift.id,
          wf_employee_id: shift.employeeID,
          inspector_id: inspector.id,
          inspector_name: inspector.name,
          department: departmentName,
          type: roleAbbreviation,
          status: shift.released ? "RELEASED" : "ASSIGNED",
          date_local: dateLocal,
          start_utc: shift.start || null,
          end_utc: shift.end || null,
          start_time_local: startTimeLocal,
          end_time_local: endTimeLocal,
          duration_minutes: duration,
          wf_role_id: shift.roleID || null,
          address: address,
          lat,
          lng,
          geocode_status: geocodeStatus,
        });
      } catch (shiftError) {
        console.error("Error processing shift:", shiftError);
        errors++;
      }
    }

    const rows = [...rowsById.values()];

    // Atomic replace: delete + insert in one database transaction
    const { data: written, error: replaceError } = await supabaseClient.rpc("replace_shifts_window", {
      p_from: fromDate,
      p_to: toDate,
      p_rows: rows,
    });

    if (replaceError) {
      throw new Error(`Failed to write shifts: ${replaceError.message}`);
    }

    const synced = typeof written === "number" ? written : rows.length;

    const response = {
      success: true,
      synced,
      unmapped,
      errors,
      addressesExtracted,
      geocoded,
      geocodeFailed,
      noAddress,
      mapboxCalls,
      total: workfeedData.length,
      dateRange: {
        from: fromDate,
        to: toDate,
      },
      summary: `Synced ${synced} shifts (${addressesExtracted} with addresses, ${geocoded} geocoded, ${geocodeFailed} geocode failures, ${noAddress} no address, ${mapboxCalls} Mapbox calls), ${unmapped} unmapped, ${errors} errors`,
    };

    console.log("Sync completed:", response);

    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error in sync-workfeed-shifts function:", error);

    const errorResponse = {
      success: false,
      synced: 0,
      unmapped: 0,
      errors: 1,
      addressesExtracted: 0,
      total: 0,
      dateRange: { from: "", to: "" },
      summary: "Sync failed",
      error: error instanceof Error ? error.message : "Unknown error",
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
