import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Fetching department options...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Query for distinct departments from both tables
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT DISTINCT department AS value, department AS label
        FROM (
          SELECT department FROM public.inspectors
          UNION
          SELECT department FROM public.inspectors_import_staging
        ) d
        WHERE department IS NOT NULL AND department <> ''
        ORDER BY department;
      `
    });

    if (error) {
      console.error('Error fetching departments:', error);
      
      // Fallback: Try direct query on inspectors table only
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('inspectors')
        .select('department')
        .not('department', 'is', null)
        .neq('department', '');
        
      if (fallbackError) {
        throw fallbackError;
      }
      
      // Extract unique departments
      const uniqueDepts = [...new Set(fallbackData?.map(d => d.department) || [])];
      const formattedDepts = uniqueDepts.map(dept => ({ value: dept, label: dept }));
      
      return new Response(JSON.stringify({ data: formattedDepts }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${data?.length || 0} departments`);

    return new Response(JSON.stringify({ data: data || [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fetch-departments function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});