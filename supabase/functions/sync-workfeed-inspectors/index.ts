import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

// 2026-10-07: Telefonnummer og adresse hentes nu fra WorkFeed – både for nye og eksisterende synskonsulenter.
// WorkFeed vinder, når der står noget i WorkFeed. Er feltet tomt i WorkFeed, beholdes det, der står i ruteplanlæggeren.
// Ændres en adresse, geokodes konsulenten igen (så ruteberegningen bruger den nye hjemadresse).

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
  street?: string;
  zip?: string;
  city?: string;
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
  phones_updated: number;
  addresses_updated: number;
  geocoding_started: number;
  workfeed_employees_with_phone: number;
  workfeed_employees_with_address: number;
  created: Array<{ name: string; email: string | null; department: string }>;
  deactivated: Array<{ name: string; email: string | null }>;
  updated: Array<{ name: string; fields: string[] }>;
  skipped: string[];
  errors: string[];
}

// Telefonnummer som 8 cifre (SMS-funktionen sætter selv +45 foran).
// Alt andet end et gyldigt dansk nummer ignoreres (fx "1111111111111111" eller "12345678"),
// så et pladsholder-nummer i WorkFeed ikke overskriver et rigtigt nummer.
function normalizePhone(phone?: string | null): string {
  let digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('45')) digits = digits.slice(2);
  if (digits.length === 12 && digits.startsWith('0045')) digits = digits.slice(4);
  if (digits.length !== 8) return '';
  if (/^(\d)\1{7}$/.test(digits) || digits === '12345678' || digits.startsWith('0')) return '';
  return digits;
}

// "Gade 1, 1234 By" ud fra WorkFeeds felter street / zip / city.
// Uden gadenavn bruges adressen ikke (et postnummer alene er ikke en hjemadresse).
function buildAddress(emp: WorkFeedEmployee): string {
  const street = (emp.street || '').trim();
  if (!/[a-zA-ZæøåÆØÅ]{2,}/.test(street)) return '';
  const zipCity = `${(emp.zip || '').trim()} ${(emp.city || '').trim()}`.trim();
  if (!zipCity) return '';
  return [street, zipCity].join(', ');
}

// Afdeling i ruteplanlæggeren: medarbejderens primære afdeling i WorkFeed.
// Har medarbejderen ingen primær afdeling, bruges den første kendte afdeling blandt de øvrige
// (ikke "Test", og ikke for administratorer/kontorpersonale).
function resolveDepartment(
  emp: WorkFeedEmployee,
  deptMap: Map<string, { id: string; name: string }>,
): { id: string; name: string } | null {
  if (emp.primaryDepartmentID) return deptMap.get(emp.primaryDepartmentID) ?? null;
  if (emp.accessLevel === 'admin') return null;
  for (const id of emp.departmentIDs || []) {
    const d = deptMap.get(id);
    if (d && d.name.toLowerCase() !== 'test') return d;
  }
  return null;
}

function sameAddress(a?: string | null, b?: string | null): boolean {
  const norm = (s?: string | null) => (s || '').toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  return norm(a) === norm(b);
}

async function triggerGeocode(supabaseUrl: string, serviceKey: string, inspectorId: string) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/geocode-inspector`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ inspector_id: inspectorId }),
    });
  } catch (e) {
    console.error(`Geocoding failed to start for inspector ${inspectorId}:`, e);
  }
}

serve(async (req) => {
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
    phones_updated: 0,
    addresses_updated: 0,
    geocoding_started: 0,
    workfeed_employees_with_phone: 0,
    workfeed_employees_with_address: 0,
    created: [],
    deactivated: [],
    updated: [],
    skipped: [],
    errors: [],
  };

  try {
    console.log('Starting WorkFeed inspector sync...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Fetch all employees from WorkFeed API
    const workfeedUrl = `${WORKFEED_BASE_URL}/companies/${WORKFEED_COMPANY_ID}/employees`;
    console.log(`Calling WorkFeed API: ${workfeedUrl}`);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (WORKFEED_API_KEY) headers['Authorization'] = WORKFEED_API_KEY;

    const workfeedResponse = await fetch(workfeedUrl, { method: 'GET', headers });
    if (!workfeedResponse.ok) {
      const errorText = await workfeedResponse.text();
      throw new Error(`WorkFeed API error: ${workfeedResponse.status} - ${errorText}`);
    }

    const workfeedData = await workfeedResponse.json();
    const allEmployees: WorkFeedEmployee[] = workfeedData.data || workfeedData || [];
    result.total_workfeed_employees = allEmployees.length;

    const employees = allEmployees.filter(emp => emp.isDeleted !== true);
    result.active_workfeed_employees = employees.length;
    result.workfeed_employees_with_phone = employees.filter(e => normalizePhone(e.phone)).length;
    result.workfeed_employees_with_address = employees.filter(e => buildAddress(e)).length;
    console.log(`Found ${employees.length} active employees in WorkFeed (${result.workfeed_employees_with_phone} with phone, ${result.workfeed_employees_with_address} with address)`);

    // Step 2: Fetch existing inspectors with wf_employee_id
    const { data: existingInspectors, error: inspectorError } = await supabase
      .from('inspectors')
      .select('id, full_name, wf_employee_id, phone, address')
      .not('wf_employee_id', 'is', null);

    if (inspectorError) {
      throw new Error(`Error fetching inspectors: ${inspectorError.message}`);
    }

    const existingByWfId = new Map(
      (existingInspectors || []).map(i => [i.wf_employee_id as string, i])
    );
    result.existing_inspectors = existingByWfId.size;

    // Step 3: Fetch department mappings
    const { data: departments, error: deptError } = await supabase
      .from('departments')
      .select('id, name, wf_department_id');

    if (deptError) {
      throw new Error(`Error fetching departments: ${deptError.message}`);
    }

    const deptMap = new Map<string, { id: string; name: string }>();
    for (const dept of departments || []) {
      if (dept.wf_department_id) {
        deptMap.set(dept.wf_department_id, { id: dept.id, name: dept.name });
      }
    }

    const toGeocode: string[] = [];

    // Step 4a: Update phone and address on existing inspectors
    for (const emp of employees) {
      const existing = existingByWfId.get(emp.id);
      if (!existing) continue;

      const wfPhone = normalizePhone(emp.phone);
      const wfAddress = buildAddress(emp);
      const updates: Record<string, unknown> = {};
      const fields: string[] = [];

      if (wfPhone && wfPhone !== normalizePhone(existing.phone)) {
        updates.phone = wfPhone;
        fields.push('telefon');
      }
      if (wfAddress && !sameAddress(wfAddress, existing.address)) {
        updates.address = wfAddress;
        updates.lat = null;
        updates.lng = null;
        updates.geocode_status = 'pending';
        updates.geocode_error = null;
        fields.push('adresse');
      }

      if (fields.length === 0) continue;

      updates.updated_at = new Date().toISOString();
      const { error: updateError } = await supabase.from('inspectors').update(updates).eq('id', existing.id);
      if (updateError) {
        result.errors.push(`Error updating ${existing.full_name}: ${updateError.message}`);
        continue;
      }
      if (fields.includes('telefon')) result.phones_updated++;
      if (fields.includes('adresse')) {
        result.addresses_updated++;
        toGeocode.push(existing.id);
      }
      result.updated.push({ name: existing.full_name, fields });
    }

    // Step 4b: Create new employees
    const newEmployees = employees.filter(emp => !existingByWfId.has(emp.id));
    console.log(`Found ${newEmployees.length} new employees to create`);

    for (const emp of newEmployees) {
      const fullName = `${emp.firstname} ${emp.lastname}`.trim();
      try {
        const deptInfo = resolveDepartment(emp, deptMap);
        if (!deptInfo) {
          result.skipped_no_department++;
          result.skipped.push(fullName);
          continue;
        }

        const address = buildAddress(emp) || null;
        const { data: inserted, error: insertError } = await supabase
          .from('inspectors')
          .insert({
            full_name: fullName,
            first_name: (emp.firstname || '').trim() || null,
            email: emp.email || null,
            phone: normalizePhone(emp.phone) || null,
            address,
            geocode_status: address ? 'pending' : 'no_address',
            wf_employee_id: emp.id,
            department_id: deptInfo.id,
            is_active: true,
          })
          .select('id')
          .single();

        if (insertError) {
          result.errors.push(`Error inserting ${fullName}: ${insertError.message}`);
          continue;
        }

        result.new_inspectors_created++;
        result.created.push({ name: fullName, email: emp.email || null, department: deptInfo.name });
        if (address && inserted?.id) toGeocode.push(inserted.id);
      } catch (empError) {
        const errorMsg = empError instanceof Error ? empError.message : String(empError);
        result.errors.push(`Error processing ${fullName}: ${errorMsg}`);
      }
    }

    // Step 5: Deactivate inspectors no longer in WorkFeed
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
          const { error: deactivateError } = await supabase
            .from('inspectors')
            .update({ is_active: false })
            .eq('id', inspector.id);

          if (deactivateError) {
            result.errors.push(`Error deactivating ${inspector.full_name}: ${deactivateError.message}`);
          } else {
            result.inspectors_deactivated++;
            result.deactivated.push({ name: inspector.full_name, email: inspector.email });
          }
        }
      }
    }

    // Step 6: Geocode new/changed home addresses
    for (const id of toGeocode) {
      await triggerGeocode(supabaseUrl, supabaseServiceKey, id);
      result.geocoding_started++;
    }

    result.success = true;
    console.log(`Summary: ${result.new_inspectors_created} created, ${result.inspectors_deactivated} deactivated, ${result.phones_updated} phones updated, ${result.addresses_updated} addresses updated, ${result.skipped_no_department} skipped (no dept)`);

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
