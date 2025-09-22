import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WorkfeedShift {
  id: string;
  employeeId: string;
  employeeName: string;
  departmentId: string;
  departmentName: string;
  roleId: string;
  roleName: string;
  startTime: string;
  endTime: string;
  date: string;
  status: string;
  comment?: string;
  [key: string]: any;
}

interface FetchShiftsRequest {
  startFrom: string;  // ISO datetime string
  startTo: string;    // ISO datetime string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const workfeedApiKey = Deno.env.get('WORKFEED_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!workfeedApiKey) {
      throw new Error('WORKFEED_API_KEY not configured');
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { startFrom, startTo }: FetchShiftsRequest = await req.json();

    if (!startFrom || !startTo) {
      throw new Error('startFrom and startTo parameters are required');
    }

    console.log(`Fetching Workfeed shifts from ${startFrom} to ${startTo}`);

    // Call Workfeed API
    const workfeedUrl = `https://europe-west1-production-eu-327a3.cloudfunctions.net/api/companies/KASqUqisoJTrzapASxwG/shifts?startFrom=${encodeURIComponent(startFrom)}&startTo=${encodeURIComponent(startTo)}`;
    
    const workfeedResponse = await fetch(workfeedUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${workfeedApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!workfeedResponse.ok) {
      const errorText = await workfeedResponse.text();
      console.error('Workfeed API error:', workfeedResponse.status, errorText);
      throw new Error(`Workfeed API error: ${workfeedResponse.status} - ${errorText}`);
    }

    const workfeedShifts: WorkfeedShift[] = await workfeedResponse.json();
    console.log(`Received ${workfeedShifts.length} shifts from Workfeed`);

    // Transform and upsert shifts
    const transformedShifts = workfeedShifts.map(shift => {
      // Extract address from comment (first line)
      const address = shift.comment?.split('\n')[0]?.trim() || '';
      
      // Convert times to proper format
      const startUtc = shift.startTime ? new Date(shift.startTime).toISOString() : null;
      const endUtc = shift.endTime ? new Date(shift.endTime).toISOString() : null;
      
      // Convert date to local date format (YYYY-MM-DD)
      const dateLocal = shift.date ? new Date(shift.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

      return {
        wf_shift_id: shift.id,
        wf_role_id: shift.roleId,
        inspector_id: shift.employeeId, // Store as text UUID
        inspector_name: shift.employeeName,
        department: shift.departmentName,
        type: shift.roleName,
        status: mapWorkfeedStatus(shift.status),
        start_utc: startUtc,
        end_utc: endUtc,
        date_local: dateLocal,
        inspection_id: null, // Will be set when shift is assigned to inspection
        created_at: new Date().toISOString(),
      };
    });

    // Upsert shifts into database
    if (transformedShifts.length > 0) {
      const { data, error } = await supabase
        .from('supabase_shifts')
        .upsert(transformedShifts, {
          onConflict: 'wf_shift_id',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('Database upsert error:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      console.log(`Successfully upserted ${transformedShifts.length} shifts`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully synced ${transformedShifts.length} shifts`,
      shifts: transformedShifts.length,
      startFrom,
      startTo
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fetch-workfeed-shifts function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper function to map Workfeed status to our status
function mapWorkfeedStatus(workfeedStatus: string): string {
  switch (workfeedStatus?.toLowerCase()) {
    case 'assigned':
    case 'scheduled':
      return 'ASSIGNED';
    case 'completed':
      return 'COMPLETED';
    case 'cancelled':
      return 'CANCELLED';
    default:
      return 'ASSIGNED'; // Default status
  }
}