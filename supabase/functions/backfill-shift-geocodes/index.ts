import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { requireStaff } from '../_shared/auth.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Inlined to mirror sync-workfeed-shifts exactly. Do not import — keeps function self-contained.
function stripFloorDoor(address: string): string {
  return address
    .replace(/,\s*(st\.?|kl\.?|\d+\.?)\s*(tv|th|mf|mid|sal|\.?\s*\d+)?(?=,|$)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
function normalizeAddress(address: string): string {
  return `${stripFloorDoor(address).toLowerCase().trim()}, danmark`;
}
function rawNormalizeAddress(address: string): string {
  return `${address.toLowerCase().trim()}, danmark`;
}

type GeocodeOutcome =
  | { status: "success"; lat: number; lng: number; source: "cache" | "mapbox" }
  | { status: "failed"; reason: string };

async function geocodeAddress(
  supabase: ReturnType<typeof createClient>,
  address: string,
  mapboxToken: string,
): Promise<GeocodeOutcome> {
  const rawKey = rawNormalizeAddress(address);
  const strippedKey = normalizeAddress(address);

  // Try cache under BOTH conventions: legacy (raw) entries first, then stripped.
  const keysToTry = rawKey === strippedKey ? [rawKey] : [rawKey, strippedKey];
  for (const key of keysToTry) {
    const { data: cached } = await supabase
      .from("mapbox_coords_cache")
      .select("lat, lon")
      .eq("normalized_address", key)
      .maybeSingle();
    if (cached?.lat && cached?.lon) {
      return { status: "success", lat: cached.lat, lng: cached.lon, source: "cache" };
    }
  }
  const normalized = strippedKey;

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(normalized)}.json?access_token=${mapboxToken}&country=DK&limit=1`;
    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.text();
      console.warn(`Mapbox HTTP ${response.status} for "${normalized}": ${body.slice(0, 200)}`);
      return { status: "failed", reason: `mapbox_http_${response.status}` };
    }
    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      // Write under BOTH keys so future lookups from either convention hit.
      const now = new Date().toISOString();
      const rows = rawKey === strippedKey
        ? [{ normalized_address: strippedKey, lat, lon: lng, updated_at: now }]
        : [
            { normalized_address: strippedKey, lat, lon: lng, updated_at: now },
            { normalized_address: rawKey, lat, lon: lng, updated_at: now },
          ];
      await supabase.from("mapbox_coords_cache").upsert(rows, { onConflict: "normalized_address" });
      return { status: "success", lat, lng, source: "mapbox" };
    }
    console.warn(`Mapbox 0 features for "${normalized}"`);
    return { status: "failed", reason: "no_features" };
  } catch (err) {
    console.error(`Geocoding exception for "${address}":`, err);
    return { status: "failed", reason: "exception" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const denied = await requireStaff(req);
  if (denied) return denied;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const mapboxToken = Deno.env.get("MAPBOX_TOKEN");
    if (!mapboxToken) {
      return new Response(JSON.stringify({ error: "MAPBOX_TOKEN missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: { shift_ids?: string[]; limit?: number } = {};
    try { body = await req.json(); } catch { /* empty body ok */ }
    const limit = Math.min(body.limit ?? 1000, 2000);

    let query = supabase
      .from("supabase_shifts")
      .select("id, address")
      .is("lat", null)
      .not("address", "is", null)
      .limit(limit);

    if (body.shift_ids && body.shift_ids.length > 0) {
      query = supabase
        .from("supabase_shifts")
        .select("id, address")
        .in("id", body.shift_ids);
    }

    const { data: rows, error } = await query;
    if (error) throw error;

    let fromCache = 0, fromMapbox = 0, failed = 0, skipped = 0;
    const failures: Array<{ id: string; address: string; reason: string }> = [];
    const samples: Array<{ id: string; address: string; lat: number; lng: number; source: string }> = [];

    for (const row of rows ?? []) {
      if (!row.address) { skipped++; continue; }
      const outcome = await geocodeAddress(supabase, row.address, mapboxToken);
      if (outcome.status === "success") {
        const { error: upErr } = await supabase
          .from("supabase_shifts")
          .update({ lat: outcome.lat, lng: outcome.lng, geocode_status: "success" })
          .eq("id", row.id);
        if (upErr) {
          failed++;
          failures.push({ id: row.id, address: row.address, reason: `update_error:${upErr.message}` });
        } else {
          if (outcome.source === "cache") fromCache++; else fromMapbox++;
          if (samples.length < 5) {
            samples.push({ id: row.id, address: row.address, lat: outcome.lat, lng: outcome.lng, source: outcome.source });
          }
        }
        if (outcome.source === "mapbox") await new Promise(r => setTimeout(r, 100));
      } else {
        failed++;
        failures.push({ id: row.id, address: row.address, reason: outcome.reason });
        await supabase
          .from("supabase_shifts")
          .update({ geocode_status: "failed" })
          .eq("id", row.id);
      }
    }

    return new Response(JSON.stringify({
      processed: rows?.length ?? 0,
      from_cache: fromCache,
      from_mapbox: fromMapbox,
      failed,
      skipped,
      samples,
      failures: failures.slice(0, 20),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("backfill error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});