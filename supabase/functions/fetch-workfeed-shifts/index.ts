import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { requireStaff } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  startDate?: string;
  endDate?: string;
  employeeId?: string;
  department?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const denied = await requireStaff(req);
  if (denied) return denied;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    let requestBody: RequestBody = {};
    if (req.method === 'POST') {
      try {
        requestBody = await req.json();
      } catch (e) {
        console.warn('Failed to parse request body:', e);
      }
    }

    console.log('Request filters:', requestBody);

    // Build query for supabase_shifts
    let query = supabase
      .from('supabase_shifts')
      .select('*')
      .order('date_local', { ascending: true })
      .order('start_utc', { ascending: true });

    // Apply filters
    if (requestBody.startDate) {
      query = query.gte('date_local', requestBody.startDate);
    }

    if (requestBody.endDate) {
      query = query.lte('date_local', requestBody.endDate);
    }

    if (requestBody.employeeId) {
      query = query.eq('inspector_id', requestBody.employeeId);
    }

    if (requestBody.department) {
      query = query.eq('department', requestBody.department);
    }

    // Execute query
    const { data, error } = await query;

    if (error) {
      console.error('Supabase query error:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    console.log(`Retrieved ${data?.length || 0} shifts from supabase_shifts`);

    // Transform data to match your frontend expectations
    const shifts = (data || []).map(shift => ({
      id: shift.id,
      wf_shift_id: shift.wf_shift_id || shift.id,
      wf_role_id: shift.wf_role_id || shift.type,
      start_utc: shift.start_utc,
      end_utc: shift.end_utc,
      date_local: shift.date_local,
      inspector_name: shift.inspector_name,
      department: shift.department,
      type: shift.type,
      status: shift.status,
      created_at: shift.created_at,
      inspection_id: shift.inspection_id,
      inspector_id: shift.inspector_id,
      // Make sure we have the address if it's stored
      address: shift.address || ''
    }));

    return new Response(JSON.stringify({
      success: true,
      shifts: shifts,
      total: shifts.length,
      filters: requestBody
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching shifts:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      shifts: [],
      total: 0,
      filters: {}
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});