import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
// To turn on again: https://europe-west1-production-eu-327a3.cloudfunctions.net/api"
const WORKFEED_API_URL = "https://europe-west1-INDSÆT KORREKTHER-eu-327a3.cloudfunctions.net/api";
const WORKFEED_API_KEY = Deno.env.get("WORKFEED_API_KEY") ?? "";
const WORKFEED_COMPANY_ID = Deno.env.get("WORKFEED_COMPANY_ID") ?? "";

// Role name mapping (inspection type to WorkFeed role code)
const ROLE_MAPPING: Record<string, string> = {
  Fraflytningssyn: "FF",
  Indflytningssyn: "IF",
  Projektsyn: "PS",
  Proforma: "PA",
  TMS: "TMS",
};

// Cache for departments and roles (5 minute TTL)
const cache = {
  departments: null as any[] | null,
  roles: null as any[] | null,
  departmentsExpiry: 0,
  rolesExpiry: 0,
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface PostWorkfeedRequest {
  shiftId: string;
}

/**
 * Get cached departments from WorkFeed API
 */
async function getCachedDepartments(): Promise<any[]> {
  const now = Date.now();

  if (cache.departments && cache.departmentsExpiry > now) {
    console.log("[post-to-workfeed] Using cached departments");
    return cache.departments;
  }

  console.log("[post-to-workfeed] Fetching departments from WorkFeed API");
  const response = await fetch(`${WORKFEED_API_URL}/companies/${WORKFEED_COMPANY_ID}/departments`, {
    headers: { Authorization: WORKFEED_API_KEY },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch departments: ${response.status}`);
  }

  cache.departments = await response.json();
  cache.departmentsExpiry = now + CACHE_TTL_MS;

  console.log(`[post-to-workfeed] Cached ${cache.departments.length} departments`);
  return cache.departments;
}

/**
 * Get cached roles from WorkFeed API
 */
async function getCachedRoles(): Promise<any[]> {
  const now = Date.now();

  if (cache.roles && cache.rolesExpiry > now) {
    console.log("[post-to-workfeed] Using cached roles");
    return cache.roles;
  }

  console.log("[post-to-workfeed] Fetching roles from WorkFeed API");
  const response = await fetch(`${WORKFEED_API_URL}/companies/${WORKFEED_COMPANY_ID}/roles`, {
    headers: { Authorization: WORKFEED_API_KEY },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch roles: ${response.status}`);
  }

  cache.roles = await response.json();
  cache.rolesExpiry = now + CACHE_TTL_MS;

  console.log(`[post-to-workfeed] Cached ${cache.roles.length} roles`);
  return cache.roles;
}

/**
 * Build WorkFeed comment in the required format:
 *
 * <address>
 *
 * <notes with DYMO replacement>
 *
 * OBS: <obs text> (only if not blank)
 */
function buildWorkfeedComment(inspection: any): string {
  if (!inspection) {
    console.warn("[post-to-workfeed] No inspection data available for comment");
    return "";
  }

  const parts: string[] = [];

  // 1. Address
  if (inspection.address) {
    parts.push(inspection.address);
    parts.push(""); // blank line
  }

  // 2. Notes with DYMO replacement (matches Python logic)
  if (inspection.notes) {
    let processedNotes = inspection.notes;

    // Replace '" "' placeholder with tenant name if DYMO is mentioned
    if (processedNotes.toUpperCase().includes("DYMO") && inspection.tenant_name) {
      processedNotes = processedNotes.replace('" "', `"${inspection.tenant_name}"`);
    }

    parts.push(processedNotes);
    parts.push(""); // blank line
  }

  // 3. OBS (only if not blank)
  if (inspection.obs && inspection.obs.trim() !== "") {
    parts.push(`OBS: ${inspection.obs.trim()}`);
  }

  // Remove trailing empty lines
  while (parts.length > 0 && parts[parts.length - 1] === "") {
    parts.pop();
  }

  return parts.join("\n");
}

/**
 * Get WorkFeed role ID for department ID and inspection type
 * @param wfDepartmentId - WorkFeed department ID (from inspector.department.wf_department_id)
 * @param inspectionType - Inspection type to map to role code
 */
async function getWorkfeedRoleId(wfDepartmentId: string, inspectionType: string): Promise<string> {
  console.log(`[post-to-workfeed] Looking up role for: ${wfDepartmentId} / ${inspectionType}`);

  // Map inspection type to role short code
  const roleShortCode = ROLE_MAPPING[inspectionType];
  if (!roleShortCode) {
    throw new Error(`Unknown inspection type: ${inspectionType}. Valid types: ${Object.keys(ROLE_MAPPING).join(", ")}`);
  }

  console.log(`[post-to-workfeed] Mapped ${inspectionType} → ${roleShortCode}`);

  // Fetch all roles from WorkFeed
  const roles = await getCachedRoles();
  console.log(`[post-to-workfeed] Searching ${roles.length} roles for match`);

  // Find the role that matches department ID AND name
  for (const role of roles) {
    if (role.departmentID === wfDepartmentId && !role.isDeleted && role.name === roleShortCode) {
      console.log(
        `[post-to-workfeed] ✅ Found matching role: ${role.name} (${role.id}) for department ${wfDepartmentId}`,
      );
      return role.id;
    }
  }

  throw new Error(
    `No matching role found for department ID '${wfDepartmentId}' and type '${roleShortCode}'. Check WorkFeed configuration.`,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  try {
    const { shiftId }: PostWorkfeedRequest = await req.json();

    console.log(`[post-to-workfeed] Processing shift: ${shiftId}`);

    // 1. Fetch shift data
    const { data: shift, error: shiftError } = await supabase
      .from("supabase_shifts")
      .select("*")
      .eq("id", shiftId)
      .single();

    if (shiftError || !shift) {
      throw new Error(`Shift not found: ${shiftError?.message}`);
    }

    // 2. Fetch inspection data (using inspection_queue_id from shift)
    const { data: inspection, error: inspectionError } = await supabase
      .from("inspection_queue")
      .select("address, notes, obs, tenant_name")
      .eq("id", shift.inspection_queue_id)
      .single();

    if (inspectionError) {
      console.warn("[post-to-workfeed] Could not fetch inspection:", inspectionError);
    }

    // 3. Fetch inspector data
    const { data: inspector, error: inspectorError } = await supabase
      .from("inspectors")
      .select("wf_employee_id, full_name, department_id")
      .eq("id", shift.inspector_id)
      .single();

    if (inspectorError || !inspector) {
      throw new Error(`Inspector not found: ${inspectorError?.message}`);
    }

    // 4. Fetch department data (using department_id from inspector)
    const { data: department, error: departmentError } = await supabase
      .from("departments")
      .select("wf_department_id")
      .eq("id", inspector.department_id)
      .single();

    if (departmentError || !department) {
      throw new Error(`Department not found for inspector: ${departmentError?.message}`);
    }

    // 5. Combine into expected structure
    const enrichedShift = {
      ...shift,
      inspection: inspection || {},
      inspector: {
        ...inspector,
        department: department,
      },
    };

    console.log(`[post-to-workfeed] Shift data:`, {
      inspector: enrichedShift.inspector_name,
      date: enrichedShift.date_local,
      type: enrichedShift.type,
      department: enrichedShift.department,
      has_inspection_data: !!enrichedShift.inspection?.address,
      has_department_id: !!enrichedShift.inspector?.department?.wf_department_id,
    });

    // 2. Get wf_department_id from inspector's department
    const wfDepartmentId = enrichedShift.inspector?.department?.wf_department_id;
    if (!wfDepartmentId) {
      throw new Error(`Inspector ${enrichedShift.inspector_name} department not found or missing wf_department_id`);
    }

    console.log(`[post-to-workfeed] Using wf_department_id: ${wfDepartmentId} for ${enrichedShift.inspector_name}`);

    // 3. Get WorkFeed role ID using wf_department_id
    const roleID = await getWorkfeedRoleId(wfDepartmentId, enrichedShift.type);

    console.log(`[post-to-workfeed] ✅ Found role ID: ${roleID} for ${enrichedShift.type}`);

    // 4. Convert local time to UTC (DST-aware for Copenhagen)
    function copenhagenToUTC(dateStr: string, timeStr: string): string {
      const [year, month, day] = dateStr.split("-").map(Number);
      const timeParts = timeStr.split(":");
      const hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1], 10);
      const testDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Copenhagen",
        timeZoneName: "shortOffset",
      });
      const parts = formatter.formatToParts(testDate);
      const offsetPart = parts.find((p) => p.type === "timeZoneName")?.value || "GMT+1";
      const offsetMatch = offsetPart.match(/GMT([+-])(\d+)/);
      let offsetHours = 1;
      if (offsetMatch) {
        offsetHours = (offsetMatch[1] === "+" ? 1 : -1) * parseInt(offsetMatch[2], 10);
      }
      return new Date(Date.UTC(year, month - 1, day, hours - offsetHours, minutes, 0)).toISOString();
    }
    const startUTC = copenhagenToUTC(enrichedShift.date_local, enrichedShift.start_time_local);
    const endUTC = copenhagenToUTC(enrichedShift.date_local, enrichedShift.end_time_local);

    console.log(`[post-to-workfeed] Time conversion:`, {
      local_start: `${enrichedShift.date_local}T${enrichedShift.start_time_local}`,
      local_end: `${enrichedShift.date_local}T${enrichedShift.end_time_local}`,
      utc_start: startUTC,
      utc_end: endUTC,
    });

    // 5. POST to WorkFeed
    const workfeedPayload = {
      roleID: roleID,
      start: startUTC,
      end: endUTC,
      employeeID: enrichedShift.wf_employee_id,
      released: true,
      comment: buildWorkfeedComment(enrichedShift.inspection),
    };

    console.log(`[post-to-workfeed] POSTing to WorkFeed:`, workfeedPayload);

    const workfeedResponse = await fetch(`${WORKFEED_API_URL}/companies/${WORKFEED_COMPANY_ID}/shifts`, {
      method: "POST",
      headers: {
        Authorization: WORKFEED_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(workfeedPayload),
    });

    if (!workfeedResponse.ok) {
      const errorText = await workfeedResponse.text();
      throw new Error(`WorkFeed API error (${workfeedResponse.status}): ${errorText}`);
    }

    const result = await workfeedResponse.json();
    console.log(`[post-to-workfeed] WorkFeed response:`, result);

    // 6. Update shift with WorkFeed ID and mark as synced
    const { error: updateError } = await supabase
      .from("supabase_shifts")
      .update({
        wf_shift_id: result.id,
        sync_status: "synced",
        status: "ASSIGNED",
        start_utc: startUTC,
        end_utc: endUTC,
        sync_attempts: enrichedShift.sync_attempts + 1,
        last_sync_attempt: new Date().toISOString(),
      })
      .eq("id", shiftId);

    if (updateError) {
      console.error(`[post-to-workfeed] Failed to update shift:`, updateError);
      throw new Error(`Failed to update shift: ${updateError.message}`);
    }

    console.log(`[post-to-workfeed] ✅ Successfully synced shift ${shiftId} to WorkFeed`);

    return new Response(
      JSON.stringify({
        success: true,
        wf_shift_id: result.id,
        shift_id: shiftId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error(`[post-to-workfeed] ❌ Error:`, error);

    // Log error to shift (best effort)
    try {
      const requestClone = req.clone();
      const body = await requestClone.json();
      const { shiftId } = body;

      // Get current sync_attempts
      const { data: currentShift } = await supabase
        .from("supabase_shifts")
        .select("sync_attempts")
        .eq("id", shiftId)
        .single();

      await supabase
        .from("supabase_shifts")
        .update({
          sync_status: "sync_failed",
          sync_error: error.message,
          sync_attempts: (currentShift?.sync_attempts || 0) + 1,
          last_sync_attempt: new Date().toISOString(),
        })
        .eq("id", shiftId);
    } catch (updateErr) {
      console.error(`[post-to-workfeed] Failed to log error to DB:`, updateErr);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
