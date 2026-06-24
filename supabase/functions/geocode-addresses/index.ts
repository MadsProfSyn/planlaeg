import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeocodeRequest {
  inspection_ids: string[];
}

interface GeocodeResult {
  inspection_id: string;
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

    const { inspection_ids } = await req.json() as GeocodeRequest;

    if (!inspection_ids || inspection_ids.length === 0) {
      throw new Error('No inspection IDs provided');
    }

    console.log(`Geocoding ${inspection_ids.length} inspections...`);

    // Fetch inspections that need geocoding
    const { data: inspections, error: fetchError } = await supabase
      .from('inspection_queue')
      .select('id, address')
      .in('id', inspection_ids)
      .or('geocode_status.eq.pending,geocode_status.is.null');

    if (fetchError) {
      throw new Error(`Failed to fetch inspections: ${fetchError.message}`);
    }

    if (!inspections || inspections.length === 0) {
      console.log('No inspections need geocoding');
      return new Response(
        JSON.stringify({ success: true, results: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${inspections.length} inspections to geocode`);

    // Process each inspection
    const results: GeocodeResult[] = [];

    for (const inspection of inspections) {
      try {
        const normalized = normalizeAddress(inspection.address);
        console.log(`Geocoding: ${inspection.address} -> ${normalized}`);

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
            throw new Error(`Address not found: ${inspection.address}`);
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

        // Update inspection_queue with coordinates
        const { error: updateError } = await supabase
          .from('inspection_queue')
          .update({
            lat,
            lng,
            geocode_status: 'success',
          })
          .eq('id', inspection.id);

        if (updateError) {
          throw new Error(`Failed to update inspection: ${updateError.message}`);
        }

        results.push({
          inspection_id: inspection.id,
          success: true,
          lat,
          lng,
        });

        console.log(`✓ Geocoded inspection ${inspection.id}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`✗ Failed to geocode inspection ${inspection.id}: ${errorMessage}`);

        // Mark as failed but don't throw - continue with other inspections
        await supabase
          .from('inspection_queue')
          .update({
            geocode_status: 'failed',
            geocode_error: errorMessage,
          })
          .eq('id', inspection.id);

        results.push({
          inspection_id: inspection.id,
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
  return `${stripFloorDoor(address).toLowerCase().trim()}, danmark`;
}

// Removes Danish floor/door segments like ", 1. 11" / ", 6. th" / ", st. tv" / ", 2. sal" / ", 3. mf"
function stripFloorDoor(address: string): string {
  return address
    .replace(/,\s*(st\.?|kl\.?|\d+\.?)\s*(tv|th|mf|mid|sal|\.?\s*\d+)?(?=,|$)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
