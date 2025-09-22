import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WorkfeedShift {
  id: string;
  employeeID: string;
  roleID: string;
  departmentID: string;
  start: string;
  end: string;
  released: boolean;
  isForSale: boolean;
  comment?: {
    message: string;
    creatorID: string;
    createdOn: string;
  } | null;
  grossPay: number;
  createTime: string;
  updateTime: string;
}

interface TransformedShift {
  id: string;
  inspector_id: string;
  inspector_name: string;
  department: string;
  type: string;
  status: string;
  date_local: string;
  start_utc: string | null;
  end_utc: string | null;
  address: string;
}

interface RequestBody {
  startDate?: string;
  endDate?: string;
  employeeId?: string;
  department?: string;
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
      console.error('WORKFEED_API_KEY not configured');
      throw new Error('WORKFEED_API_KEY not configured');
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    let requestBody: RequestBody = {};
    if (req.method === 'POST') {
      try {
        requestBody = await req.json();
      } catch (e) {
        console.error('Failed to parse request body:', e);
      }
    }

    console.log('Request body:', requestBody);

    // Default to today if no start date provided
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startFrom = requestBody.startDate 
      ? new Date(requestBody.startDate).toISOString() 
      : today.toISOString();

    // Default to 30 days from start date if no end date provided
    const defaultEndDate = new Date(startFrom);
    defaultEndDate.setDate(defaultEndDate.getDate() + 30);
    
    const startTo = requestBody.endDate 
      ? new Date(requestBody.endDate).toISOString() 
      : defaultEndDate.toISOString();

    console.log(`Fetching shifts from ${startFrom} to ${startTo}`);

    // Build Workfeed API URL
    let workfeedUrl = `https://europe-west1-production-eu-327a3.cloudfunctions.net/api/companies/KASqUqisoJTrzapASxwG/shifts?startFrom=${encodeURIComponent(startFrom)}&startTo=${encodeURIComponent(startTo)}`;
    
    // Add employee filter if provided
    if (requestBody.employeeId) {
      workfeedUrl += `&employeeId=${encodeURIComponent(requestBody.employeeId)}`;
    }

    console.log('Workfeed URL:', workfeedUrl);

    // Fetch shifts from Workfeed
    const workfeedResponse = await fetch(workfeedUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${workfeedApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Workfeed response status:', workfeedResponse.status);

    if (!workfeedResponse.ok) {
      const errorText = await workfeedResponse.text();
      console.error('Workfeed API error:', workfeedResponse.status, errorText);
      throw new Error(`Workfeed API error: ${workfeedResponse.status} - ${errorText}`);
    }

    const workfeedShifts: WorkfeedShift[] = await workfeedResponse.json();
    console.log(`Received ${workfeedShifts.length} shifts from Workfeed`);

    // Filter to only current and future shifts
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const filteredShifts = workfeedShifts.filter(shift => {
      try {
        const shiftDate = new Date(shift.start);
        shiftDate.setHours(0, 0, 0, 0);
        return shiftDate >= now;
      } catch (e) {
        console.warn('Failed to parse shift start time:', shift.start, e);
        return false;
      }
    });

    console.log(`Filtered to ${filteredShifts.length} current/future shifts`);

    if (filteredShifts.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        shifts: [],
        total: 0,
        filters: {
          startDate: startFrom,
          endDate: startTo,
          employeeId: requestBody.employeeId,
          department: requestBody.department
        },
        message: "No current or future shifts found"
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch mapping data from Supabase
    console.log('Fetching mapping data from Supabase...');
    
    const [inspectorsResult, rolesResult, roleMappingsResult] = await Promise.allSettled([
      supabase
        .from('inspectors_import_staging')
        .select('wf_employee_id, full_name, department, wf_department_id_by_name'),
      supabase
        .from('roles')
        .select('id, code, label'),
      supabase
        .from('role_mappings')
        .select('wf_role_id, wf_role_name, role_id')
    ]);

    // Create lookup maps
    const employeeMap = new Map<string, { name: string; department: string }>();
    const departmentMap = new Map<string, string>();
    const roleMap = new Map<string, string>();

    // Process inspector mappings
    if (inspectorsResult.status === 'fulfilled' && !inspectorsResult.value.error) {
      inspectorsResult.value.data?.forEach(inspector => {
        if (inspector.wf_employee_id) {
          employeeMap.set(inspector.wf_employee_id, {
            name: inspector.full_name || `Employee ${inspector.wf_employee_id}`,
            department: inspector.department || 'Unknown Department'
          });
        }
        // Also map department IDs
        if (inspector.wf_department_id_by_name && inspector.department) {
          departmentMap.set(inspector.wf_department_id_by_name, inspector.department);
        }
      });
      console.log(`Loaded ${employeeMap.size} employees and ${departmentMap.size} departments`);
    } else {
      console.warn('Failed to load inspectors:', inspectorsResult.status === 'fulfilled' ? inspectorsResult.value.error : inspectorsResult.reason);
    }

    // Process role mappings
    let roleIdToLabelMap = new Map<string, string>();
    
    if (rolesResult.status === 'fulfilled' && !rolesResult.value.error) {
      rolesResult.value.data?.forEach(role => {
        roleIdToLabelMap.set(role.id, role.label);
      });
    }

    if (roleMappingsResult.status === 'fulfilled' && !roleMappingsResult.value.error) {
      roleMappingsResult.value.data?.forEach(mapping => {
        const roleLabel = roleIdToLabelMap.get(mapping.role_id) || mapping.wf_role_name;
        roleMap.set(mapping.wf_role_id, roleLabel);
      });
      console.log(`Loaded ${roleMap.size} role mappings`);
    } else {
      console.warn('Failed to load role mappings:', roleMappingsResult.status === 'fulfilled' ? roleMappingsResult.value.error : roleMappingsResult.reason);
    }

    // Transform shifts to your format
    const transformedShifts: TransformedShift[] = filteredShifts
      .map(shift => {
        try {
          const address = shift.comment?.message?.split('\n')[0]?.trim() || '';
          const startUtc = shift.start ? new Date(shift.start).toISOString() : null;
          const endUtc = shift.end ? new Date(shift.end).toISOString() : null;
          const dateLocal = new Date(shift.start).toISOString().split('T')[0];

          // Get mapped data
          const employeeInfo = employeeMap.get(shift.employeeID);
          const departmentName = departmentMap.get(shift.departmentID);
          const roleName = roleMap.get(shift.roleID);

          return {
            id: shift.id,
            inspector_id: shift.employeeID,
            inspector_name: employeeInfo?.name || `Employee ${shift.employeeID}`,
            department: employeeInfo?.department || departmentName || `Department ${shift.departmentID}`,
            type: roleName || `Role ${shift.roleID}`,
            status: shift.released ? 'ASSIGNED' : 'UNASSIGNED',
            date_local: dateLocal,
            start_utc: startUtc,
            end_utc: endUtc,
            address: address,
          };
        } catch (error) {
          console.warn(`Failed to transform shift ${shift.id}:`, error);
          return null;
        }
      })
      .filter(shift => shift !== null) as TransformedShift[];

    // Apply additional filters
    let finalShifts = transformedShifts;

    if (requestBody.department) {
      finalShifts = finalShifts.filter(shift => 
        shift.department.toLowerCase().includes(requestBody.department!.toLowerCase())
      );
    }

    // Sort by date and time
    finalShifts.sort((a, b) => {
      const dateComparison = a.date_local.localeCompare(b.date_local);
      if (dateComparison !== 0) return dateComparison;
      
      if (a.start_utc && b.start_utc) {
        return a.start_utc.localeCompare(b.start_utc);
      }
      return 0;
    });

    console.log(`Returning ${finalShifts.length} filtered shifts`);

    return new Response(JSON.stringify({
      success: true,
      shifts: finalShifts,
      total: finalShifts.length,
      filters: {
        startDate: startFrom,
        endDate: startTo,
        employeeId: requestBody.employeeId,
        department: requestBody.department
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fetch-shifts function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false,
      shifts: [],
      total: 0,
      filters: {}
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});