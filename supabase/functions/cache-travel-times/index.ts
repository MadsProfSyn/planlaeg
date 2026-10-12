import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireStaff } from '../_shared/auth.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Coordinate {
  lng: number;
  lat: number;
  id: string;
}

interface CacheTravelTimesRequest {
  coordinates: Coordinate[];
}

interface TravelTimeResult {
  from_id: string;
  to_id: string;
  key: string;
  minutes: number;
  distance_km: number | null;
  cached: boolean;
}

// Generate cache key in format: lng1,lat1->lng2,lat2
function generateCacheKey(from: Coordinate, to: Coordinate): string {
  // Round to 5 decimal places for consistency
  const lng1 = from.lng.toFixed(5);
  const lat1 = from.lat.toFixed(5);
  const lng2 = to.lng.toFixed(5);
  const lat2 = to.lat.toFixed(5);
  return `${lng1},${lat1}->${lng2},${lat2}`;
}

// Call Mapbox Directions API for a single pair
async function fetchTravelTime(
  from: Coordinate,
  to: Coordinate,
  mapboxToken: string
): Promise<{ minutes: number; distance_km: number } | null> {
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from.lng},${from.lat};${to.lng},${to.lat}?access_token=${mapboxToken}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Mapbox API error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      // Duration is in seconds, convert to minutes
      const durationMinutes = Math.round(data.routes[0].duration / 60);
      // Distance is in meters, convert to km (rounded to 2 decimals)
      const distanceKm = Math.round((data.routes[0].distance / 1000) * 100) / 100;
      return { minutes: durationMinutes, distance_km: distanceKm };
    }
    
    console.warn("No routes found in Mapbox response");
    return null;
  } catch (error) {
    console.error("Error calling Mapbox Directions API:", error);
    return null;
  }
}

Deno.serve(async (req) => {
  console.log("🌍 ========================================");
  console.log("🌍 cache-travel-times Edge Function invoked");
  console.log("🌍 ========================================");
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const denied = await requireStaff(req);
  if (denied) return denied;

  try {
    const mapboxToken = Deno.env.get("MAPBOX_TOKEN");
    if (!mapboxToken) {
      console.error("❌ MAPBOX_TOKEN not configured!");
      throw new Error("MAPBOX_TOKEN not configured");
    }
    console.log("✅ MAPBOX_TOKEN is configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { coordinates } = (await req.json()) as CacheTravelTimesRequest;
    
    console.log(`📍 Received ${coordinates?.length || 0} coordinates`);

    if (!coordinates || coordinates.length < 2) {
      console.log("⏭️ Not enough coordinates (need at least 2), returning early");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Need at least 2 coordinates",
          results: [],
          stats: { cached: 0, fetched: 0, failed: 0 }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate all unique pairs
    const pairs: Array<{ from: Coordinate; to: Coordinate; key: string }> = [];
    for (let i = 0; i < coordinates.length; i++) {
      for (let j = 0; j < coordinates.length; j++) {
        if (i !== j) {
          const from = coordinates[i];
          const to = coordinates[j];
          const key = generateCacheKey(from, to);
          pairs.push({ from, to, key });
        }
      }
    }

    console.log(`🔗 Generated ${pairs.length} unique coordinate pairs to check`);

    // Check cache for existing entries
    const allKeys = pairs.map(p => p.key);
    const { data: cachedEntries, error: cacheError } = await supabase
      .from("mapbox_travel_cache")
      .select("key, minutes, distance_km")
      .in("key", allKeys);

    if (cacheError) {
      console.error("Error querying cache:", cacheError);
    }

    const cachedMap = new Map<string, { minutes: number; distance_km: number | null }>();
    (cachedEntries || []).forEach(entry => {
      cachedMap.set(entry.key, { minutes: entry.minutes, distance_km: entry.distance_km });
    });

    console.log(`📊 Cache status: ${cachedMap.size} HITS, ${pairs.length - cachedMap.size} MISSES (need to fetch from Mapbox)`);

    // Separate cached and uncached pairs
    const results: TravelTimeResult[] = [];
    const toFetch: Array<{ from: Coordinate; to: Coordinate; key: string }> = [];

    for (const pair of pairs) {
      if (cachedMap.has(pair.key)) {
        const cached = cachedMap.get(pair.key)!;
        results.push({
          from_id: pair.from.id,
          to_id: pair.to.id,
          key: pair.key,
          minutes: cached.minutes,
          distance_km: cached.distance_km,
          cached: true,
        });
      } else {
        toFetch.push(pair);
      }
    }

    // Fetch uncached pairs (with rate limiting)
    const newEntries: Array<{ key: string; minutes: number; distance_km: number }> = [];
    let fetchedCount = 0;
    let failedCount = 0;

    // Process in batches of 10 to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < toFetch.length; i += batchSize) {
      const batch = toFetch.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (pair) => {
        const result = await fetchTravelTime(pair.from, pair.to, mapboxToken);
        return { pair, result };
      });

      const batchResults = await Promise.all(batchPromises);

      for (const { pair, result } of batchResults) {
        if (result !== null) {
          results.push({
            from_id: pair.from.id,
            to_id: pair.to.id,
            key: pair.key,
            minutes: result.minutes,
            distance_km: result.distance_km,
            cached: false,
          });
          newEntries.push({ key: pair.key, minutes: result.minutes, distance_km: result.distance_km });
          fetchedCount++;
        } else {
          failedCount++;
        }
      }

      // Small delay between batches to respect rate limits
      if (i + batchSize < toFetch.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Upsert new entries to cache
    if (newEntries.length > 0) {
      const { error: upsertError } = await supabase
        .from("mapbox_travel_cache")
        .upsert(
          newEntries.map(e => ({
            key: e.key,
            minutes: e.minutes,
            distance_km: e.distance_km,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "key" }
        );

      if (upsertError) {
        console.error("Error upserting to cache:", upsertError);
      } else {
        console.log(`Cached ${newEntries.length} new travel times`);
      }
    }

    const stats = {
      total_pairs: pairs.length,
      cached: cachedMap.size,
      fetched: fetchedCount,
      failed: failedCount,
    };

    console.log("✅ ========================================");
    console.log("✅ Travel time caching COMPLETE:", stats);
    console.log("✅ ========================================");

    return new Response(
      JSON.stringify({
        success: true,
        results,
        stats,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in cache-travel-times:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
