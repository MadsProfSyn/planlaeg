import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WORKFEED_API_URL = "https://europe-west1-production-eu-327a3.cloudfunctions.net/api";
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

// Cache for roles (5 minute TTL)
const cache = {
  roles: null as any[] | null,
  rolesExpiry: 0,
};

const CACHE_TTL_MS = 5 * 60 * 1000;

interface ManualShiftAssignment {
  monday_item_id: number;
  inspector_id: string;
  start_time: string;
  end_time: string;
  date: string;
}

interface ManualShiftRequest {
  assignments: ManualShiftAssignment[];
}

interface AssignmentResult {
  monday_item_id: number;
  wf_shift_id: string | null;
  status: "success" | "failed";
  error?: string;
}

/**
 * Get cached roles from WorkFeed API
 */
async function getCachedRoles(): Promise<any[]> {
  const now = Date.now();

  if (cache.roles && cache.rolesExpiry > now) {
    console.log("[send-manual-shifts] Using cached roles");
    return cache.roles;
  }

  console.log("[send-manual-shifts] Fetching roles from WorkFeed API");
  const response = await fetch(`${WORKFEED_API_URL}/companies/${WORKFEED_COMPANY_ID}/roles`, {
    headers: { Authorization: WORKFEED_API_KEY },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch roles: ${response.status}`);
  }

  cache.roles = await response.json();
  cache.rolesExpiry = now + CACHE_TTL_MS;

  console.log(`[send-manual-shifts] Cached ${cache.roles.length} roles`);
  return cache.roles;
}

/**
 * Get WorkFeed role ID for department ID and inspection type
 */
async function getWorkfeedRoleId(wfDepartmentId: string, inspectionType: string): Promise<string> {
  console.log(`[send-manual-shifts] Looking up role for: ${wfDepartmentId} / ${inspectionType}`);

  // Map inspection type to role short code
  const roleShortCode = ROLE_MAPPING[inspectionType];
  if (!roleShortCode) {
    throw new Error(`Unknown inspection type: ${inspectionType}`);
  }

  console.log(`[send-manual-shifts] Mapped ${inspectionType} → ${roleShortCode}`);

  // Fetch all roles from WorkFeed
  const roles = await getCachedRoles();

  // Find the role that matches department ID AND name
  for (const role of roles) {
    if (role.departmentID === wfDepartmentId && !role.isDeleted && role.name === roleShortCode) {
      console.log(`[send-manual-shifts] Found matching role: ${role.name} (${role.id})`);
      return role.id;
    }
  }

  throw new Error(`No matching role found for department '${wfDepartmentId}' and type '${roleShortCode}'`);
}

/**
 * Build WorkFeed comment from monday item
 */
function buildWorkfeedComment(item: any): string {
  const parts: string[] = [];

  // 1. Address
  if (item.adresse) {
    parts.push(item.adresse);
    parts.push("");
  }

  // 2. Notes with DYMO replacement
  const raw = item.raw || {};
  if (raw.Note) {
    let note = raw.Note;
    if (note.toUpperCase().includes("DYMO") && raw.Lejersnavn) {
      note = note.replace('" "', `"${raw.Lejersnavn}"`);
    }
    parts.push(note);
    parts.push("");
  }

  // 3. OBS if present
  if (raw.OBS && raw.OBS.trim() !== "") {
    parts.push(`OBS: ${raw.OBS.trim()}`);
  }

  // Remove trailing empty lines
  while (parts.length > 0 && parts[parts.length - 1] === "") {
    parts.pop();
  }

  return parts.join("\n");
}

/**
 * Convert local Copenhagen time to UTC ISO string
 */
function convertToUTC(dateStr: string, timeStr: string): string {
  // dateStr: "2026-01-03", timeStr: "09:00"
  // Copenhagen is UTC+1 in winter, UTC+2 in summer (DST)
  // For simplicity, using +01:00 (winter time) - can be improved with proper timezone library
  const localDateTime = `${dateStr}T${timeStr}:00+01:00`;
  return new Date(localDateTime).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { assignments }: ManualShiftRequest = await req.json();

    if (!assignments || assignments.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No assignments provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-manual-shifts] Processing ${assignments.length} assignments`);

    const results: AssignmentResult[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (const assignment of assignments) {
      try {
        console.log(`[send-manual-shifts] Processing monday_item_id: ${assignment.monday_item_id}`);

        // 1. Fetch monday item
        const { data: mondayItem, error: mondayError } = await supabase
          .from("monday_items_selected")
          .select("*")
          .eq("id", assignment.monday_item_id)
          .single();

        if (mondayError || !mondayItem) {
          throw new Error(`Monday item not found: ${mondayError?.message}`);
        }

        // 2. Fetch inspector with department
        const { data: inspector, error: inspectorError } = await supabase
          .from("inspectors")
          .select("id, wf_employee_id, full_name, department_id")
          .eq("id", assignment.inspector_id)
          .single();

        if (inspectorError || !inspector) {
          throw new Error(`Inspector not found: ${inspectorError?.message}`);
        }

        // 3. Fetch department for wf_department_id
        const { data: department, error: deptError } = await supabase
          .from("departments")
          .select("wf_department_id, name")
          .eq("id", inspector.department_id)
          .single();

        if (deptError || !department?.wf_department_id) {
          throw new Error(`Department not found or missing wf_department_id: ${deptError?.message}`);
        }

        // 4. Map synstype to role code and get WorkFeed role ID
        const inspectionType = mondayItem.synstype;
        if (!inspectionType) {
          throw new Error("Missing synstype on monday item");
        }

        const roleId = await getWorkfeedRoleId(department.wf_department_id, inspectionType);

        // 5. Convert times to UTC
        const startUTC = convertToUTC(assignment.date, assignment.start_time);
        const endUTC = convertToUTC(assignment.date, assignment.end_time);

        // 6. Build comment
        const comment = buildWorkfeedComment(mondayItem);

        // 7. POST to WorkFeed
        const workfeedPayload = {
          roleID: roleId,
          employeeID: inspector.wf_employee_id,
          start: startUTC,
          end: endUTC,
          released: true,
          comment: comment,
        };

        console.log(`[send-manual-shifts] POSTing to WorkFeed:`, {
          roleID: roleId,
          employeeID: inspector.wf_employee_id,
          start: startUTC,
          end: endUTC,
        });

        const wfResponse = await fetch(`${WORKFEED_API_URL}/companies/${WORKFEED_COMPANY_ID}/shifts`, {
          method: "POST",
          headers: {
            Authorization: WORKFEED_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(workfeedPayload),
        });

        if (!wfResponse.ok) {
          const errorText = await wfResponse.text();
          throw new Error(`WorkFeed API error (${wfResponse.status}): ${errorText}`);
        }

        const wfResult = await wfResponse.json();
        console.log(`[send-manual-shifts] WorkFeed response:`, wfResult);

        // 8. Update monday_items_selected with status
        const { error: updateError } = await supabase
          .from("monday_items_selected")
          .update({
            schedule_status: "sent_to_workfeed",
            wf_shift_id: wfResult.id,
            scheduled_inspector_id: assignment.inspector_id,
            scheduled_date: assignment.date,
            scheduled_start_time: assignment.start_time,
            scheduled_end_time: assignment.end_time,
            scheduled_at: new Date().toISOString(),
          })
          .eq("id", assignment.monday_item_id);

        if (updateError) {
          console.error(`[send-manual-shifts] Failed to update monday item:`, updateError);
          // Don't throw - shift was created successfully in WorkFeed
        }

        results.push({
          monday_item_id: assignment.monday_item_id,
          wf_shift_id: wfResult.id,
          status: "success",
        });
        successCount++;
        console.log(`[send-manual-shifts] ✅ Successfully sent shift for monday_item_id: ${assignment.monday_item_id}`);

      } catch (error: any) {
        console.error(`[send-manual-shifts] ❌ Error for monday_item_id ${assignment.monday_item_id}:`, error);
        results.push({
          monday_item_id: assignment.monday_item_id,
          wf_shift_id: null,
          status: "failed",
          error: error.message,
        });
        failedCount++;
      }
    }

    console.log(`[send-manual-shifts] Completed: ${successCount} success, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: failedCount === 0,
        sent: successCount,
        failed: failedCount,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error(`[send-manual-shifts] ❌ Fatal error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
