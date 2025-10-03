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
    
    // Try supabase_availability first, fallback to supabase_aviliablity
    let tableName = 'supabase_availability';
    const { error: testError } = await supabase
      .from(tableName)
      .select('id', { count: 'exact', head: true })
      .limit(1);
    
    if (testError?.message?.includes('does not exist')) {
      tableName = 'supabase_aviliablity';
      console.log('Falling back to supabase_aviliablity table');
    }

    // Build query - get availability with inspector joins
    let query = supabase
      .from(tableName)
      .select(`
        id,
        inspector_id,
        inspector_name,
        date_local,
        start_time_local,
        end_time_local,
        is_available,
        inspectors!inner (
          full_name,
          address,
          departments (
            name
          )
        )
      `, { count: 'exact' })
      .eq('is_available', true);

    // Apply date range filter
    if (from && to) {
      query = query.gte('date_local', from).lte('date_local', to);
    }

    // Apply search filter
    if (q && q.trim() !== '') {
      const searchTerm = q.trim();
      query = query.or(`inspector_name.ilike.%${searchTerm}%,inspectors.address.ilike.%${searchTerm}%`);
    }

    // Apply sorting
    const sortColumn = sortBy === 'navn' ? 'inspector_name' : 
                       sortBy === 'dato' ? 'date_local' :
                       sortBy === 'adresse' ? 'inspectors.address' : 'date_local';
    const sortDirection = sortOrder === 'desc' ? false : true;
    query = query.order(sortColumn, { ascending: sortDirection });
    
    // Add secondary sort
    query = query.order('start_time_local', { ascending: true });

    // Apply pagination
    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching available inspectors:', error);
      throw error;
    }

    // Get all inspector IDs to fetch skills
    const inspectorIds = [...new Set(data?.map((row: any) => row.inspector_id) || [])];
    
    // Fetch skills for all inspectors
    const { data: skillsData } = await supabase
      .from('inspector_skills')
      .select('inspector_id, inspection_type')
      .in('inspector_id', inspectorIds)
      .eq('is_active', true);

    // Build skills map
    const skillsMap = new Map<string, string[]>();
    skillsData?.forEach((skill: any) => {
      if (!skillsMap.has(skill.inspector_id)) {
        skillsMap.set(skill.inspector_id, []);
      }
      skillsMap.get(skill.inspector_id)?.push(skill.inspection_type);
    });

    // Transform data to match expected UI format
    const transformedData = (data || []).map((row: any) => {
      const skills = skillsMap.get(row.inspector_id) || [];
      const department = row.inspectors?.departments?.name || '';
      
      // Apply department filter in memory (since join filter is complex)
      if (afdeling && afdeling !== '' && department !== afdeling) {
        return null;
      }
      
      // Apply synstyper filter
      if (!synstyper_all && synstyper && synstyper.length > 0) {
        const hasMatchingSkill = skills.some(skill => synstyper.includes(skill));
        if (!hasMatchingSkill) return null;
      }
      
      // Format time label
      let tidspunkt_label = 'Hele dagen';
      if (row.start_time_local && row.end_time_local) {
        tidspunkt_label = `${row.start_time_local.substring(0, 5)} - ${row.end_time_local.substring(0, 5)}`;
      } else if (row.start_time_local) {
        tidspunkt_label = `Fra ${row.start_time_local.substring(0, 5)}`;
      } else if (row.end_time_local) {
        tidspunkt_label = `Til ${row.end_time_local.substring(0, 5)}`;
      }
      
      return {
        availability_id: row.id,
        inspector_uuid: row.inspector_id,
        navn: row.inspector_name,
        afdeling: department,
        synstyper: skills,
        adresse: row.inspectors?.address || '',
        dato: row.date_local,
        start_tid: row.start_time_local,
        slut_tid: row.end_time_local,
        tidspunkt_label
      };
    }).filter((row: any) => row !== null);

    console.log(`Found ${count} total availability records, returning ${transformedData.length} after filtering`);

    return new Response(JSON.stringify({
      data: transformedData,
      total: transformedData.length,
      page,
      pageSize,
      totalPages: Math.ceil(transformedData.length / pageSize)
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