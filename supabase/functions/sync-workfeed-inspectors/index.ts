import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WORKFEED_BASE_URL = Deno.env.get('WORKFEED_BASE_URL') || 'https://europe-west1-production-eu-327a3.cloudfunctions.net/api';
const WORKFEED_API_KEY = Deno.env.get('WORKFEED_API_KEY') || '';
const WORKFEED_COMPANY_ID = Deno.env.get('WORKFEED_COMPANY_ID') || 'KASqUqisoJTrzapASxwG';

interface WorkFeedEmployee {
  id: string;
  firstname: string;
  lastname: string;
  email?: string;
  phone?: string;
  primaryDepartmentID?: string;
  departmentIDs?: string[];
  isDeleted?: boolean;
  accessLevel?: string;
}

interface SyncResult {
  success: boolean;
  total_workfeed_employees: number;
  active_workfeed_employees: number;
  existing_inspectors: number;
  new_inspectors_created: number;
  skipped_no_department: number;
  skipped_archived: number;
  inspectors_deactivated: number;
  created: Array<{ name: string; email: string | null; department: string }>;
  deactivated: Array<{ name: string; email: string | null }>;
  errors: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const result: SyncResult = {
    success: false,
    total_workfeed_employees: 0,
    active_workfeed_employees: 0,
    existing_inspectors: 0,
    new_inspectors_created: 0,
    skipped_no_department: 0,
    skipped_archived: 0,
    inspectors_deactivated: 0,
    created: [],
    deactivated: [],
    errors: [],
  };

  try {
    console.log('Starting WorkFeed inspector sync...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Fetch all employees from WorkFeed API
    console.log('Fetching employees from WorkFeed...');
    const workfeedUrl = `${WORKFEED_BASE_URL}/companies/${WORKFEED_COMPANY_ID}/employees`;
    console.log(`Calling WorkFeed API: ${workfeedUrl}`);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (WORKFEED_API_KEY) {
      headers['Authorization'] = WORKFEED_API_KEY;
    }
    
    const workfeedResponse = await fetch(workfeedUrl, {
      method: 'GET',
      headers,
    });

    if (!workfeedResponse.ok) {
      const errorText = await workfeedResponse.text();
      throw new Error(`WorkFeed API error: ${workfeedResponse.status} - ${errorText}`);
    }

    const workfeedData = await workfeedResponse.json();
    const allEmployees: WorkFeedEmployee[] = workfeedData.data || workfeedData || [];
    result.total_workfeed_employees = allEmployees.length;
    console.log(`Found ${allEmployees.length} total employees in WorkFeed`);
    
    // Log first employee structure to understand the data
    if (allEmployees.length > 0) {
      console.log('Sample employee structure:', JSON.stringify(allEmployees[0], null, 2));
    }
    
    // Filter to only active (non-deleted) employees
    // WorkFeed uses 'isDeleted' field - filter those out
    const employees = allEmployees.filter(emp => emp.isDeleted !== true);
    result.active_workfeed_employees = employees.length;
    console.log(`Found ${employees.length} active (non-deleted) employees in WorkFeed`);

    // Step 2: Fetch existing inspectors with wf_employee_id
    console.log('Fetching existing inspectors from Supabase...');
    const { data: existingInspectors, error: inspectorError } = await supabase
      .from('inspectors')
      .select('id, wf_employee_id')
      .not('wf_employee_id', 'is', null);

    if (inspectorError) {
      throw new Error(`Error fetching inspectors: ${inspectorError.message}`);
    }

    const existingWfIds = new Set(
      (existingInspectors || []).map(i => i.wf_employee_id)
    );
    result.existing_inspectors = existingWfIds.size;
    console.log(`Found ${existingWfIds.size} existing inspectors with wf_employee_id`);

    // Step 3: Fetch department mappings
    console.log('Fetching department mappings...');
    const { data: departments, error: deptError } = await supabase
      .from('departments')
      .select('id, name, wf_department_id');

    if (deptError) {
      throw new Error(`Error fetching departments: ${deptError.message}`);
    }

    // Create mapping from WorkFeed department ID to Supabase department ID
    const deptMap = new Map<string, { id: string; name: string }>();
    for (const dept of departments || []) {
      if (dept.wf_department_id) {
        deptMap.set(dept.wf_department_id, { id: dept.id, name: dept.name });
      }
    }
    console.log(`Loaded ${deptMap.size} department mappings`);

    // Step 4: Identify new employees and insert them
    const newEmployees = employees.filter(emp => !existingWfIds.has(emp.id));
    console.log(`Found ${newEmployees.length} new employees to create`);

    for (const emp of newEmployees) {
      try {
        const fullName = `${emp.firstname} ${emp.lastname}`.trim();
        
        // Get department mapping using primaryDepartmentID
        const deptInfo = emp.primaryDepartmentID ? deptMap.get(emp.primaryDepartmentID) : null;
        
        if (!deptInfo) {
          result.skipped_no_department++;
          console.log(`Skipping employee without valid department: ${fullName} (dept: ${emp.primaryDepartmentID || 'none'})`);
          continue;
        }

        // Insert new inspector
        const { error: insertError } = await supabase
          .from('inspectors')
          .insert({
            full_name: fullName,
            email: emp.email || null,
            phone: emp.phone || null,
            wf_employee_id: emp.id,
            department_id: deptInfo.id,
            is_active: true,
          });

        if (insertError) {
          result.errors.push(`Error inserting ${fullName}: ${insertError.message}`);
          console.error(`Error inserting inspector ${fullName}:`, insertError);
          continue;
        }

        result.new_inspectors_created++;
        result.created.push({
          name: fullName,
          email: emp.email || null,
          department: deptInfo.name,
        });
        console.log(`Created inspector: ${fullName} (${deptInfo.name})`);
      } catch (empError) {
        const fullName = `${emp.firstname} ${emp.lastname}`.trim();
        const errorMsg = empError instanceof Error ? empError.message : String(empError);
        result.errors.push(`Error processing ${fullName}: ${errorMsg}`);
        console.error(`Error processing employee ${fullName}:`, empError);
      }
    }

    // Step 5: Deactivate inspectors no longer in WorkFeed
    console.log('Checking for inspectors to deactivate...');
    const activeWfIds = new Set(employees.map(emp => emp.id));
    
    const { data: activeInspectors, error: activeError } = await supabase
      .from('inspectors')
      .select('id, full_name, email, wf_employee_id')
      .eq('is_active', true)
      .not('wf_employee_id', 'is', null);

    if (activeError) {
      console.error('Error fetching active inspectors for deactivation check:', activeError);
    } else {
      for (const inspector of activeInspectors || []) {
        if (!activeWfIds.has(inspector.wf_employee_id)) {
          // Deactivate - no longer in WorkFeed
          const { error: deactivateError } = await supabase
            .from('inspectors')
            .update({ is_active: false })
            .eq('id', inspector.id);

          if (deactivateError) {
            result.errors.push(`Error deactivating ${inspector.full_name}: ${deactivateError.message}`);
            console.error(`Error deactivating inspector ${inspector.full_name}:`, deactivateError);
          } else {
            result.inspectors_deactivated++;
            result.deactivated.push({ name: inspector.full_name, email: inspector.email });
            console.log(`Deactivated inspector: ${inspector.full_name} (no longer in WorkFeed)`);
          }
        }
      }
    }

    result.success = true;
    console.log('WorkFeed inspector sync completed successfully');
    console.log(`Summary: ${result.new_inspectors_created} created, ${result.inspectors_deactivated} deactivated, ${result.skipped_no_department} skipped (no dept)`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('WorkFeed inspector sync failed:', errorMsg);
    result.errors.push(errorMsg);
    
    return new Response(JSON.stringify(result), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
