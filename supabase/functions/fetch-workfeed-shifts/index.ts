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
  const startTime = Date.now();
  console.log(`🚀 Edge function started at ${new Date().toISOString()}`);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight request handled');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get environment variables
    console.log('🔑 Checking environment variables...');
    const workfeedApiKey = Deno.env.get('WORKFEED_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log('Environment check:', {
      hasWorkfeedApiKey: !!workfeedApiKey,
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseServiceKey: !!supabaseServiceKey,
      workfeedApiKeyLength: workfeedApiKey?.length || 0
    });

    if (!workfeedApiKey) {
      throw new Error('WORKFEED_API_KEY not configured');
    }
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    // Initialize Supabase client
    console.log('📊 Initializing Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    console.log(`📝 Processing ${req.method} request...`);
    let requestBody: RequestBody = {};
    
    if (req.method === 'POST') {
      try {
        const rawBody = await req.text();
        console.log('Raw request body:', rawBody);
        requestBody = JSON.parse(rawBody);
        console.log('Parsed POST request body:', requestBody);
      } catch (e) {
        console.warn('Failed to parse POST request body:', e);
      }
    }

    // Set date range with proper formatting to match Postman exactly
    console.log('📅 Processing dates...');
    const today = new Date();
    
    let startFrom: string;
    let startTo: string;

    if (requestBody.startDate) {
      // Convert YYYY-MM-DD to YYYY-MM-DDTHH:mm:ss.sssZ format
      const startDate = new Date(requestBody.startDate + 'T00:00:00.000Z');
      startFrom = startDate.toISOString();
    } else {
      today.setHours(0, 0, 0, 0);
      startFrom = today.toISOString();
    }

    if (requestBody.endDate) {
      // Convert YYYY-MM-DD to end of day format like in Postman
      const endDate = new Date(requestBody.endDate + 'T23:59:59.999Z');
      startTo = endDate.toISOString();
    } else {
      const defaultEndDate = new Date(today);
      defaultEndDate.setDate(today.getDate() + 30);
      defaultEndDate.setHours(23, 59, 59, 999);
      startTo = defaultEndDate.toISOString();
    }

    console.log('Date processing result:', {
      inputStartDate: requestBody.startDate,
      inputEndDate: requestBody.endDate,
      processedStartFrom: startFrom,
      processedStartTo: startTo
    });

    // Build Workfeed API URL exactly like in Postman
    let workfeedUrl = `https://europe-west1-production-eu-327a3.cloudfunctions.net/api/companies/KASqUqisoJTrzapASxwG/shifts?startFrom=${encodeURIComponent(startFrom)}&startTo=${encodeURIComponent(startTo)}`;
    
    if (requestBody.employeeId) {
      workfeedUrl += `&employeeId=${encodeURIComponent(requestBody.employeeId)}`;
    }

    console.log('🌐 Making Workfeed API call...');
    console.log('URL:', workfeedUrl);
    console.log('Headers:', {
      Authorization: `${workfeedApiKey.substring(0, 8)}...${workfeedApiKey.substring(workfeedApiKey.length - 4)}`,
      ContentType: 'application/json'
    });

    // Fetch shifts from Workfeed
    const workfeedResponse = await fetch(workfeedUrl, {
      method: 'GET',
      headers: {
        'Authorization': workfeedApiKey,
        'Content-Type': 'application/json',
      },
    });

    console.log('📞 Workfeed API response:', {
      status: workfeedResponse.status,
      statusText: workfeedResponse.statusText,
      headers: Object.fromEntries(workfeedResponse.headers.entries())
    });

    if (!workfeedResponse.ok) {
      const errorText = await workfeedResponse.text();
      console.error('❌ Workfeed API error:', workfeedResponse.status, errorText);
      throw new Error(`Workfeed API error: ${workfeedResponse.status} - ${errorText}`);
    }

    const workfeedShifts: WorkfeedShift[] = await workfeedResponse.json();
    console.log(`✅ Received ${workfeedShifts.length} shifts from Workfeed`);
    
    // Log first few shifts for debugging
    if (workfeedShifts.length > 0) {
      console.log('First shift sample:', JSON.stringify(workfeedShifts[0], null, 2));
      console.log('Shift dates found:', workfeedShifts.slice(0, 5).map(s => ({ id: s.id, start: s.start, employeeID: s.employeeID })));
    }

    // If no shifts received, return early with details
    if (!workfeedShifts || workfeedShifts.length === 0) {
      console.log('⚠️ No shifts received from Workfeed API');
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
        message: "No shifts found in Workfeed API response",
        debug: {
          requestUrl: workfeedUrl,
          responseStatus: workfeedResponse.status,
          processingTime: Date.now() - startTime
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filter to only current and future shifts
    console.log('🔍 Filtering shifts...');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    console.log('Filtering from date:', now.toISOString());
    
    const filteredShifts = workfeedShifts.filter(shift => {
      try {
        const shiftDate = new Date(shift.start);
        shiftDate.setHours(0, 0, 0, 0);
        const include = shiftDate >= now;
        if (!include) {
          console.log(`Filtering out past shift: ${shift.id} (${shift.start})`);
        }
        return include;
      } catch (e) {
        console.warn('Failed to parse shift start time:', shift.start, e);
        return false;
      }
    });

    console.log(`📊 Filtered to ${filteredShifts.length} current/future shifts`);

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
        message: "No current or future shifts found after filtering",
        debug: {
          totalShiftsFromAPI: workfeedShifts.length,
          filteredShifts: filteredShifts.length,
          filterDate: now.toISOString(),
          processingTime: Date.now() - startTime
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch mapping data from Supabase
    console.log('🗄️ Fetching mapping data from Supabase...');
    
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

    console.log('Supabase queries result:', {
      inspectors: inspectorsResult.status,
      roles: rolesResult.status,
      roleMappings: roleMappingsResult.status
    });

    // Create lookup maps
    const employeeMap = new Map<string, { name: string; department: string }>();
    const departmentMap = new Map<string, string>();
    const roleMap = new Map<string, string>();

    // Process inspector mappings
    if (inspectorsResult.status === 'fulfilled' && !inspectorsResult.value.error) {
      const inspectors = inspectorsResult.value.data || [];
      console.log(`Processing ${inspectors.length} inspectors...`);
      
      inspectors.forEach(inspector => {
        if (inspector.wf_employee_id) {
          employeeMap.set(inspector.wf_employee_id, {
            name: inspector.full_name || `Employee ${inspector.wf_employee_id}`,
            department: inspector.department || 'Unknown Department'
          });
        }
        if (inspector.wf_department_id_by_name && inspector.department) {
          departmentMap.set(inspector.wf_department_id_by_name, inspector.department);
        }
      });
      
      console.log(`✅ Loaded ${employeeMap.size} employees and ${departmentMap.size} departments`);
      
      // Log some sample mappings
      const sampleEmployees = Array.from(employeeMap.entries()).slice(0, 3);
      console.log('Sample employee mappings:', sampleEmployees);
    } else {
      console.warn('❌ Failed to load inspectors:', inspectorsResult.status === 'fulfilled' ? inspectorsResult.value.error : inspectorsResult.reason);
    }

    // Process role mappings
    let roleIdToLabelMap = new Map<string, string>();
    
    if (rolesResult.status === 'fulfilled' && !rolesResult.value.error) {
      const roles = rolesResult.value.data || [];
      roles.forEach(role => {
        roleIdToLabelMap.set(role.id, role.label);
      });
      console.log(`✅ Loaded ${roleIdToLabelMap.size} role labels`);
    }

    if (roleMappingsResult.status === 'fulfilled' && !roleMappingsResult.value.error) {
      const roleMappings = roleMappingsResult.value.data || [];
      roleMappings.forEach(mapping => {
        const roleLabel = roleIdToLabelMap.get(mapping.role_id) || mapping.wf_role_name;
        roleMap.set(mapping.wf_role_id, roleLabel);
      });
      console.log(`✅ Loaded ${roleMap.size} role mappings`);
      
      // Log some sample mappings
      const sampleRoles = Array.from(roleMap.entries()).slice(0, 3);
      console.log('Sample role mappings:', sampleRoles);
    } else {
      console.warn('❌ Failed to load role mappings:', roleMappingsResult.status === 'fulfilled' ? roleMappingsResult.value.error : roleMappingsResult.reason);
    }

    // Transform shifts to your format
    console.log('🔄 Transforming shifts...');
    const transformedShifts: TransformedShift[] = filteredShifts
      .map((shift, index) => {
        try {
          const address = shift.comment?.message?.split('\n')[0]?.trim() || '';
          const startUtc = shift.start ? new Date(shift.start).toISOString() : null;
          const endUtc = shift.end ? new Date(shift.end).toISOString() : null;
          const dateLocal = new Date(shift.start).toISOString().split('T')[0];

          // Get mapped data
          const employeeInfo = employeeMap.get(shift.employeeID);
          const departmentName = departmentMap.get(shift.departmentID);
          const roleName = roleMap.get(shift.roleID);

          const transformed = {
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

          // Log first few transformations
          if (index < 3) {
            console.log(`Transformation ${index + 1}:`, {
              original: {
                id: shift.id,
                employeeID: shift.employeeID,
                roleID: shift.roleID,
                departmentID: shift.departmentID
              },
              mapped: {
                employee: employeeInfo,
                department: departmentName,
                role: roleName
              },
              result: transformed
            });
          }

          return transformed;
        } catch (error) {
          console.warn(`Failed to transform shift ${shift.id}:`, error);
          return null;
        }
      })
      .filter(shift => shift !== null) as TransformedShift[];

    // Apply additional filters
    let finalShifts = transformedShifts;
    if (requestBody.department) {
      const beforeFilter = finalShifts.length;
      finalShifts = finalShifts.filter(shift => 
        shift.department.toLowerCase().includes(requestBody.department!.toLowerCase())
      );
      console.log(`🔍 Department filter "${requestBody.department}" reduced shifts from ${beforeFilter} to ${finalShifts.length}`);
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

    const processingTime = Date.now() - startTime;
    console.log(`🎉 Successfully returning ${finalShifts.length} shifts (processing took ${processingTime}ms)`);

    return new Response(JSON.stringify({
      success: true,
      shifts: finalShifts,
      total: finalShifts.length,
      filters: {
        startDate: startFrom,
        endDate: startTo,
        employeeId: requestBody.employeeId,
        department: requestBody.department
      },
      debug: {
        processingTime,
        workfeedShiftsReceived: workfeedShifts.length,
        filteredShifts: filteredShifts.length,
        transformedShifts: transformedShifts.length,
        finalShifts: finalShifts.length,
        mappingsLoaded: {
          employees: employeeMap.size,
          departments: departmentMap.size,
          roles: roleMap.size
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('💥 Error in fetch-shifts function:', error);
    console.error('Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false,
      shifts: [],
      total: 0,
      filters: {},
      debug: {
        processingTime,
        errorStack: error.stack
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});