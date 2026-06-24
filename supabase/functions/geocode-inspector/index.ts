import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeAddress(address: string): string {
  return stripFloorDoor(address).trim().toLowerCase().replace(/\s+/g, ' ');
}

// Removes Danish floor/door segments like ", 1. 11" / ", 6. th" / ", st. tv" / ", 2. sal" / ", 3. mf"
function stripFloorDoor(address: string): string {
  return address
    .replace(/,\s*(st\.?|kl\.?|\d+\.?)\s*(tv|th|mf|mid|sal|\.?\s*\d+)?(?=,|$)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { inspector_id } = await req.json();
    if (!inspector_id) {
      return new Response(JSON.stringify({ error: 'inspector_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const mapboxToken = Deno.env.get('MAPBOX_TOKEN') || Deno.env.get('MAPBOX_PUBLIC_TOKEN') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch inspector
    const { data: inspector, error: fetchError } = await supabase
      .from('inspectors')
      .select('id, address, full_name')
      .eq('id', inspector_id)
      .single();

    if (fetchError || !inspector) {
      return new Response(JSON.stringify({ error: 'Inspector not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // No address → clear coords
    if (!inspector.address || !inspector.address.trim()) {
      await supabase
        .from('inspectors')
        .update({ lat: null, lng: null, geocode_status: 'no_address', geocode_error: null })
        .eq('id', inspector_id);

      return new Response(JSON.stringify({ success: true, status: 'no_address' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalized = normalizeAddress(inspector.address);
    console.log(`Geocoding inspector ${inspector.full_name}: "${normalized}"`);

    // Check cache
    const { data: cached } = await supabase
      .from('mapbox_coords_cache')
      .select('lat, lon')
      .eq('normalized_address', normalized)
      .maybeSingle();

    let lat: number;
    let lng: number;

    if (cached) {
      console.log(`Cache hit for "${normalized}"`);
      lat = cached.lat;
      lng = cached.lon;
    } else {
      // Call Mapbox
      const encoded = encodeURIComponent(inspector.address.trim());
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?country=DK&limit=1&access_token=${mapboxToken}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`Mapbox API error: ${res.status}`);
      }

      const data = await res.json();
      if (!data.features || data.features.length === 0) {
        await supabase
          .from('inspectors')
          .update({ geocode_status: 'failed', geocode_error: 'No results from Mapbox' })
          .eq('id', inspector_id);

        return new Response(JSON.stringify({ success: false, status: 'no_results' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const [lngResult, latResult] = data.features[0].center;
      lat = latResult;
      lng = lngResult;

      // Cache the result
      await supabase
        .from('mapbox_coords_cache')
        .upsert({ normalized_address: normalized, lat, lon: lng, updated_at: new Date().toISOString() }, { onConflict: 'normalized_address' });

      console.log(`Geocoded and cached: ${lat}, ${lng}`);
    }

    // Update inspector
    await supabase
      .from('inspectors')
      .update({ lat, lng, geocode_status: 'success', geocode_error: null })
      .eq('id', inspector_id);

    return new Response(JSON.stringify({ success: true, status: 'success', lat, lng }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Geocode inspector error:', msg);

    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
