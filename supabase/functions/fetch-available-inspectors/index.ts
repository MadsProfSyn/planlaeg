import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FilterParams {
  from: string;
  to: string;
  afdeling: string | null;
  synstyper: string[];
  synstyper_all: boolean;
  q: string;
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const params: FilterParams = await req.json();
    console.log('Fetching available inspectors with params:', params);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      from,
      to,
      afdeling,
      synstyper = [],
      synstyper_all = true,
      q = '',
      page = 1,
      pageSize = 50,
      sortBy = 'dato',
      sortOrder = 'asc'
    } = params;

    const offset = (page - 1) * pageSize;
    
    // Build the base query
    let query = supabase
      .from('v_available_inspectors')
      .select('*', { count: 'exact' });

    // Apply date range filter
    if (from && to) {
      query = query.gte('dato', from).lte('dato', to);
    }

    // Apply department filter
    if (afdeling && afdeling !== '') {
      query = query.eq('afdeling', afdeling);
    }

    // Apply search filter
    if (q && q.trim() !== '') {
      const searchTerm = q.trim();
      query = query.or(`navn.ilike.%${searchTerm}%,adresse.ilike.%${searchTerm}%,afdeling.ilike.%${searchTerm}%`);
    }

    // Apply synstyper filter (only if not "all" and has specific types)
    if (!synstyper_all && synstyper && synstyper.length > 0) {
      // Use overlaps operator for array intersection
      query = query.overlaps('synstyper', synstyper);
    }

    // Apply sorting
    const sortColumn = sortBy || 'dato';
    const sortDirection = sortOrder === 'desc' ? false : true;
    query = query.order(sortColumn, { ascending: sortDirection });
    
    // Add secondary sort by name for consistency
    if (sortBy !== 'navn') {
      query = query.order('navn', { ascending: true });
    }

    // Apply pagination
    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching available inspectors:', error);
      throw error;
    }

    console.log(`Found ${count} total inspectors, returning page ${page} with ${data?.length || 0} results`);

    return new Response(JSON.stringify({
      data: data || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fetch-available-inspectors function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});