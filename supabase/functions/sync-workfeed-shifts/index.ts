import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncShiftsRequest {
  startDate?: string;
  endDate?: string;
  forceSync?: boolean;
}

interface SyncShiftsResponse {
  success: boolean;
  synced: number;
  skipped: number;
  errors: number;
  total: number;
  dateRange: {
    from: string;
    to: string;
  };
  summary: string;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { startDate, endDate, forceSync = false }: SyncShiftsRequest = await req.json();
    
    // Default to today if no dates provided
    const today = new Date().toISOString().split('T')[0];
    const fromDate = startDate || today;
    const toDate = endDate || today;

    console.log(`Syncing shifts for ${fromDate} to ${toDate}, forceSync: ${forceSync}`);

    // Fetch shifts from Workfeed API
    const workfeedApiKey = Deno.env.get('WORKFEED_API_KEY');
    const workfeedCompanyId = Deno.env.get('WORKFEED_COMPANY_ID') || 'KASqUqisoJTrzapASxwG';
    
    if (!workfeedApiKey) {
      throw new Error('WORKFEED_API_KEY is not configured');
    }

    const startFromISO = `${fromDate}T00:00:00.000Z`;
    const startToISO = `${toDate}T23:59:59.999Z`;
    const workfeedUrl = `https://europe-west1-production-eu-327a3.cloudfunctions.net/api/companies/${workfeedCompanyId}/shifts?startFrom=${startFromISO}&startTo=${startToISO}`;

    console.log('Fetching from Workfeed:', workfeedUrl);

    const workfeedResponse = await fetch(workfeedUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${workfeedApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!workfeedResponse.ok) {
      throw new Error(`Workfeed API error: ${workfeedResponse.status} ${workfeedResponse.statusText}`);
    }

    const workfeedData = await workfeedResponse.json();
    console.log(`Received ${workfeedData.length || 0} shifts from Workfeed`);

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    // Process each shift
    for (const shift of workfeedData) {
      try {
        // Check if shift already exists (unless forcing sync)
        if (!forceSync && shift.id) {
          const { data: existing } = await supabaseClient
            .from('supabase_shifts')
            .select('id')
            .eq('wf_shift_id', shift.id)
            .single();

          if (existing) {
            skipped++;
            continue;
          }
        }

        // Prepare shift data
        const shiftData = {
          wf_shift_id: shift.id,
          inspector_id: shift.employeeId || shift.inspector_id,
          inspector_name: shift.employeeName || shift.inspector_name || 'Unknown',
          department: shift.departmentName || shift.department || 'Unknown',
          type: shift.roleName || shift.type || 'Unknown',
          status: shift.status || 'ASSIGNED',
          date_local: shift.startDateTime ? shift.startDateTime.split('T')[0] : fromDate,
          start_utc: shift.startDateTime || null,
          end_utc: shift.endDateTime || null,
          wf_role_id: shift.roleId || null,
        };

        // Upsert the shift
        const { error: upsertError } = await supabaseClient
          .from('supabase_shifts')
          .upsert(shiftData, { 
            onConflict: 'wf_shift_id',
            ignoreDuplicates: false 
          });

        if (upsertError) {
          console.error('Error upserting shift:', upsertError);
          errors++;
        } else {
          synced++;
        }

      } catch (shiftError) {
        console.error('Error processing shift:', shiftError);
        errors++;
      }
    }

    const response: SyncShiftsResponse = {
      success: true,
      synced,
      skipped,
      errors,
      total: workfeedData.length || 0,
      dateRange: {
        from: fromDate,
        to: toDate
      },
      summary: `Synced ${synced} shifts, skipped ${skipped}, ${errors} errors`
    };

    console.log('Sync completed:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in sync-workfeed-shifts function:', error);
    
    const errorResponse: SyncShiftsResponse = {
      success: false,
      synced: 0,
      skipped: 0,
      errors: 1,
      total: 0,
      dateRange: { from: '', to: '' },
      summary: 'Sync failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});