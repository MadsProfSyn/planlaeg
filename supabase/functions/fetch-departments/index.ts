import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { requireStaff } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const denied = await requireStaff(req);
  if (denied) return denied;

  try {
    console.log('Fetching department options...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Query translated department names from afdeling_to_department
    const { data, error } = await supabase
      .from('afdeling_to_department')
      .select('department')
      .order('department');

    if (error) {
      console.error('Error fetching departments:', error);
      throw error;
    }

    // Format departments for dropdown (these are the translated names)
    const formattedDepts = (data || []).map(dept => ({ 
      value: dept.department, 
      label: dept.department 
    }));

    console.log(`Found ${formattedDepts.length} departments`);

    return new Response(JSON.stringify({ data: formattedDepts }), {
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