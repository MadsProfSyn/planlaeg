import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeocodeRequest {
  item_ids: number[];  // monday_items_selected.id values
}

interface GeocodeResult {
  item_id: number;
  success: boolean;
  lat?: number;
  lng?: number;
  error?: string;
}

interface Coordinate {
  id: string;
  lat: number;
  lng: number;
}

// Cache travel times between all geocoded items for the same dates
async function cacheTravelTimes(
  supabase: ReturnType<typeof createClient>,
  geocodedItems: Array<{ id: number; lat: number; lng: number; scheduled_date: string | null }>
): Promise<void> {
  if (geocodedItems.length < 2) {
    console.log("⏭️ Not enough geocoded items to cache travel times");
    return;
  }

  // Group items by scheduled_date
  const dateGroups = new Map<string, typeof geocodedItems>();
  for (const item of geocodedItems) {
    const date = item.scheduled_date || "unscheduled";
    if (!dateGroups.has(date)) {
      dateGroups.set(date, []);
    }
    dateGroups.get(date)!.push(item);
  }

  console.log(`📅 Found items across ${dateGroups.size} date groups`);

  // For each date group, fetch ALL items for that date and cache travel times
  for (const [date, items] of dateGroups) {
    if (date === "unscheduled" || items.length < 2) continue;

    // Fetch ALL geocoded items for this date (not just the newly geocoded ones)
    const { data: allItemsForDate, error: fetchError } = await supabase
      .from("monday_items_selected")
      .select("id, lat, lng")
      .eq("scheduled_date", date)
      .eq("geocode_status", "success")
      .not("lat", "is", null)
      .not("lng", "is", null);

    if (fetchError || !allItemsForDate || allItemsForDate.length < 2) {
      console.log(`⏭️ Skipping date ${date}: not enough geocoded items`);
      continue;
    }

    console.log(`🗓️ Caching travel times for ${allItemsForDate.length} items on ${date}`);

    const coordinates: Coordinate[] = allItemsForDate.map(i => ({
      id: String(i.id),
      lat: i.lat!,
      lng: i.lng!,
    }));

    // Call the cache-travel-times function internally
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const response = await fetch(`${supabaseUrl}/functions/v1/cache-travel-times`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ coordinates }),
      });

      const result = await response.json();
      console.log(`✅ Travel times cached for ${date}:`, result.stats || result);
    } catch (err) {
      console.warn(`⚠️ Failed to cache travel times for ${date}:`, err);
    }
  }
}

Deno.serve(async (req) => {
  console.log("🌍 ========================================");
  console.log("🌍 geocode-monday-items Edge Function invoked");
  console.log("🌍 ========================================");

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const mapboxToken = Deno.env.get('MAPBOX_TOKEN')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Support both direct calls with item_ids and webhook payloads
    const body = await req.json();
    let item_ids: number[] = [];

    if (body.item_ids && Array.isArray(body.item_ids)) {
      // Direct call with item_ids
      item_ids = body.item_ids;
      console.log(`📥 Direct call with ${item_ids.length} item IDs`);
    } else if (body.type === 'INSERT' && body.record) {
      // Database webhook payload (single record)
      item_ids = [body.record.id];
      console.log(`📥 Webhook INSERT for item ID: ${body.record.id}`);
    } else if (body.type === 'INSERT' && body.old_record === null && body.record) {
      // Alternative webhook format
      item_ids = [body.record.id];
      console.log(`📥 Webhook INSERT (alt format) for item ID: ${body.record.id}`);
    } else {
      console.log("⚠️ Unknown payload format:", JSON.stringify(body).slice(0, 200));
      throw new Error('No item IDs provided - expected item_ids array or webhook INSERT payload');
    }

    if (item_ids.length === 0) {
      throw new Error('No item IDs provided');
    }

    console.log(`🌍 Geocoding ${item_ids.length} monday_items_selected items...`);

    // Fetch items that need geocoding
    const { data: items, error: fetchError } = await supabase
      .from('monday_items_selected')
      .select('id, adresse, scheduled_date')
      .in('id', item_ids)
      .or('geocode_status.eq.pending,geocode_status.is.null');

    if (fetchError) {
      throw new Error(`Failed to fetch items: ${fetchError.message}`);
    }

    if (!items || items.length === 0) {
      console.log('✅ No items need geocoding (all already geocoded)');
      return new Response(
        JSON.stringify({ success: true, results: [], summary: { total: 0, successful: 0, failed: 0 } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📍 Found ${items.length} items to geocode`);

    // Process each item
    const results: GeocodeResult[] = [];

    for (const item of items) {
      try {
        if (!item.adresse) {
          throw new Error('No address provided');
        }

        const normalized = normalizeAddress(item.adresse);
        console.log(`Geocoding: ${item.adresse} -> ${normalized}`);

        // Check cache first
        const { data: cached } = await supabase
          .from('mapbox_coords_cache')
          .select('lat, lon')
          .eq('normalized_address', normalized)
          .maybeSingle();

        let lat: number;
        let lng: number;

        if (cached) {
          console.log(`Cache hit for ${normalized}`);
          lat = cached.lat;
          lng = cached.lon;
        } else {
          // Call Mapbox Geocoding API
          const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(normalized)}.json?access_token=${mapboxToken}&country=DK&limit=1`;
          
          const response = await fetch(url);
          const data = await response.json();

          if (!data.features || data.features.length === 0) {
            throw new Error(`Address not found: ${item.adresse}`);
          }

          [lng, lat] = data.features[0].center;
          console.log(`Mapbox returned: lat=${lat}, lng=${lng}`);

          // Store in cache
          await supabase.from('mapbox_coords_cache').upsert({
            normalized_address: normalized,
            lat,
            lon: lng,
            updated_at: new Date().toISOString(),
          });

          console.log(`Cached coordinates for ${normalized}`);
        }

        // Update monday_items_selected with coordinates
        const { error: updateError } = await supabase
          .from('monday_items_selected')
          .update({
            lat,
            lng,
            geocode_status: 'success',
          })
          .eq('id', item.id);

        if (updateError) {
          throw new Error(`Failed to update item: ${updateError.message}`);
        }

        results.push({
          item_id: item.id,
          success: true,
          lat,
          lng,
        });

        console.log(`✓ Geocoded item ${item.id}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`✗ Failed to geocode item ${item.id}: ${errorMessage}`);

        // Mark as failed but don't throw - continue with other items
        await supabase
          .from('monday_items_selected')
          .update({
            geocode_status: 'failed',
          })
          .eq('id', item.id);

        results.push({
          item_id: item.id,
          success: false,
          error: errorMessage,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`📊 Geocoding complete: ${successCount}/${results.length} successful`);

    // After geocoding, cache travel times for successfully geocoded items
    const geocodedItems = results
      .filter(r => r.success && r.lat && r.lng)
      .map(r => {
        const originalItem = items.find(i => i.id === r.item_id);
        return {
          id: r.item_id,
          lat: r.lat!,
          lng: r.lng!,
          scheduled_date: originalItem?.scheduled_date || null,
        };
      });

    if (geocodedItems.length > 0) {
      console.log(`🚗 Now caching travel times for ${geocodedItems.length} geocoded items...`);
      await cacheTravelTimes(supabase, geocodedItems);
    }

    console.log("✅ ========================================");
    console.log("✅ geocode-monday-items COMPLETE");
    console.log("✅ ========================================");

    return new Response(
      JSON.stringify({
        success: true,
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: results.length - successCount,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Geocoding error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function normalizeAddress(address: string): string {
  return `${stripFloorDoor(address).toLowerCase().trim()}, danmark`;
}

// Removes Danish floor/door segments like ", 1. 11" / ", 6. th" / ", st. tv" / ", 2. sal" / ", 3. mf"
function stripFloorDoor(address: string): string {
  return address
    .replace(/,\s*(st\.?|kl\.?|\d+\.?)\s*(tv|th|mf|mid|sal|\.?\s*\d+)?(?=,|$)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
