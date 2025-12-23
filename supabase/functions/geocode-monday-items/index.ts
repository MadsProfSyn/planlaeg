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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const mapboxToken = Deno.env.get('MAPBOX_TOKEN')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { item_ids } = await req.json() as GeocodeRequest;

    if (!item_ids || item_ids.length === 0) {
      throw new Error('No item IDs provided');
    }

    console.log(`🌍 Geocoding ${item_ids.length} monday_items_selected items...`);

    // Fetch items that need geocoding
    const { data: items, error: fetchError } = await supabase
      .from('monday_items_selected')
      .select('id, adresse')
      .in('id', item_ids)
      .or('geocode_status.eq.pending,geocode_status.is.null');

    if (fetchError) {
      throw new Error(`Failed to fetch items: ${fetchError.message}`);
    }

    if (!items || items.length === 0) {
      console.log('No items need geocoding');
      return new Response(
        JSON.stringify({ success: true, results: [], summary: { total: 0, successful: 0, failed: 0 } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${items.length} items to geocode`);

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
    console.log(`Geocoding complete: ${successCount}/${results.length} successful`);

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
  return `${address.toLowerCase().trim()}, danmark`;
}
