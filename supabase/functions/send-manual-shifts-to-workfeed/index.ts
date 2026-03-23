import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// WorkFeed API config
const WORKFEED_API_URL = "https://europe-west1-production-eu-327a3.cloudfunctions.net/api";
const WORKFEED_API_KEY = Deno.env.get("WORKFEED_API_KEY") ?? "";
const WORKFEED_COMPANY_ID = Deno.env.get("WORKFEED_COMPANY_ID") ?? "";

// Monday.com API config
const MONDAY_API_URL = "https://api.monday.com/v2";
const MONDAY_TOKEN = Deno.env.get("MONDAY_TOKEN") ?? "";
const MONDAY_BOARD_ID = "3797295927";

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
  monday_synced: boolean;
  error?: string;
}

/**
 * Normalize time to HH:MM:SS format
 */
function normalizeTime(time: string): string {
  if (!time) return "00:00:00";
  const parts = time.split(":");
  const hours = parts[0]?.padStart(2, "0") || "00";
  const minutes = parts[1]?.padStart(2, "0") || "00";
  const seconds = parts[2]?.padStart(2, "0") || "00";
  return `${hours}:${minutes}:${seconds}`;
}
/**
 * Convert local Danish time (Europe/Copenhagen) to UTC for Monday.com
 * Denmark is UTC+1 in winter, UTC+2 in summer (DST)
 */
function localTimeToUTC(date: string, time: string): { date: string; time: string } {
  const [year, month, day] = date.split("-").map(Number);
  const timeParts = time.split(":");
  const hours = parseInt(timeParts[0], 10);
  const minutes = parseInt(timeParts[1], 10);
  
  // Create a date object for the given local time to check DST
  const testDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  
  // Use Intl to determine the timezone offset for Copenhagen on this date
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Copenhagen",
    timeZoneName: "shortOffset",
  });
  const parts = formatter.formatToParts(testDate);
  const offsetPart = parts.find((p) => p.type === "timeZoneName")?.value || "GMT+1";
  
  // Parse offset (e.g., "GMT+1" or "GMT+2")
  const offsetMatch = offsetPart.match(/GMT([+-])(\d+)/);
  let offsetHours = 1; // Default to +1 (winter time)
  if (offsetMatch) {
    const sign = offsetMatch[1] === "+" ? 1 : -1;
    offsetHours = sign * parseInt(offsetMatch[2], 10);
  }
  
  // Calculate UTC time by subtracting the offset
  let utcHours = hours - offsetHours;
  let utcDay = day;
  let utcMonth = month;
  let utcYear = year;
  
  // Handle day wraparound for early morning times
  if (utcHours < 0) {
    utcHours += 24;
    utcDay -= 1;
    if (utcDay < 1) {
      utcMonth -= 1;
      if (utcMonth < 1) {
        utcMonth = 12;
        utcYear -= 1;
      }
      const daysInPrevMonth = new Date(utcYear, utcMonth, 0).getDate();
      utcDay = daysInPrevMonth;
    }
  } else if (utcHours >= 24) {
    utcHours -= 24;
    utcDay += 1;
    const daysInMonth = new Date(utcYear, utcMonth, 0).getDate();
    if (utcDay > daysInMonth) {
      utcDay = 1;
      utcMonth += 1;
      if (utcMonth > 12) {
        utcMonth = 1;
        utcYear += 1;
      }
    }
  }
  
  const utcDateStr = `${utcYear}-${String(utcMonth).padStart(2, "0")}-${String(utcDay).padStart(2, "0")}`;
  const utcTimeStr = `${String(utcHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
  
  return { date: utcDateStr, time: utcTimeStr };
}

/**
 * Update Monday.com item with scheduling info
 */
async function updateMondayItem(
  itemId: number,
  inspectorName: string,
  date: string,
  startTime: string
): Promise<{ success: boolean; error?: string }> {
  if (!MONDAY_TOKEN) {
    return { success: false, error: "MONDAY_TOKEN not configured" };
  }

  try {
    const normalizedTime = normalizeTime(startTime);
    
    // Convert local Copenhagen time to UTC for Monday.com
    const utc = localTimeToUTC(date, normalizedTime);
    
    console.log(`[monday-sync] Time conversion: local ${date} ${normalizedTime} → UTC ${utc.date} ${utc.time}`);
    
    const columnValues = {
      text_mkyw2jhq: inspectorName,
      date5: { date: utc.date, time: utc.time },
      boolean: { checked: "true" },
    };

    const mutation = `
      mutation {
        change_multiple_column_values(
          board_id: ${MONDAY_BOARD_ID},
          item_id: ${itemId},
          column_values: ${JSON.stringify(JSON.stringify(columnValues))}
        ) {
          id
        }
      }
    `;

    console.log(`[monday-sync] Updating item ${itemId} with:`, { inspectorName, date, localTime: normalizedTime, utcDate: utc.date, utcTime: utc.time });

    const response = await fetch(MONDAY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: MONDAY_TOKEN,
        "API-Version": "2024-10",
      },
      body: JSON.stringify({ query: mutation }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Monday API HTTP error (${response.status}): ${errorText}` };
    }

    const result = await response.json();

    if (result.errors && result.errors.length > 0) {
      return { success: false, error: result.errors.map((e: any) => e.message).join(", ") };
    }

    console.log(`[monday-sync] ✅ Successfully updated Monday item ${itemId}`);
    return { success: true };

  } catch (error: any) {
    console.error(`[monday-sync] ❌ Error updating Monday item ${itemId}:`, error);
    return { success: false, error: error.message };
  }
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

  // 2. Notes — prefer user-edited note column, fall back to raw.Note
  const raw = item.raw || {};
  const noteText = item.note || raw.Note || "";
  if (noteText) {
    let note = noteText;
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
 * Convert local Copenhagen time to UTC ISO string (DST-aware)
 */
function convertToUTC(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const timeParts = timeStr.split(":");
  const hours = parseInt(timeParts[0], 10);
  const minutes = parseInt(timeParts[1], 10);

  // Detect DST offset for Copenhagen on this date
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

  // Build UTC date by subtracting offset
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours - offsetHours, minutes, 0));
  return utcDate.toISOString();
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
    let mondaySyncedCount = 0;

    for (const assignment of assignments) {
      let mondaySynced = false;
      
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

        // 8. Update monday_items_selected with status (initially sent_to_workfeed)
        const { error: updateError } = await supabase
          .from("monday_items_selected")
          .update({
            schedule_status: "sent_to_workfeed",
            wf_shift_id: wfResult.id,
            scheduled_inspector_id: assignment.inspector_id,
            scheduled_inspector_name: inspector.full_name,
            scheduled_date: assignment.date,
            scheduled_start_time: assignment.start_time,
            scheduled_end_time: assignment.end_time,
            scheduled_at: new Date().toISOString(),
          })
          .eq("id", assignment.monday_item_id);

        if (updateError) {
          console.error(`[send-manual-shifts] Failed to update monday item:`, updateError);
        }

        // 9. Sync to Monday.com board
        if (mondayItem.item_id) {
          const mondayResult = await updateMondayItem(
            mondayItem.item_id,
            inspector.full_name,
            assignment.date,
            assignment.start_time
          );

          if (mondayResult.success) {
            mondaySynced = true;
            mondaySyncedCount++;

            // Update status to scheduled_in_monday
            const { error: mondayUpdateError } = await supabase
              .from("monday_items_selected")
              .update({ schedule_status: "scheduled_in_monday" })
              .eq("id", assignment.monday_item_id);

            if (mondayUpdateError) {
              console.error(`[send-manual-shifts] Failed to update monday sync status:`, mondayUpdateError);
            }
          } else {
            console.error(`[send-manual-shifts] Monday sync failed for item ${mondayItem.item_id}:`, mondayResult.error);
          }
        } else {
          console.warn(`[send-manual-shifts] No item_id on monday_items_selected row, skipping Monday sync`);
        }

        results.push({
          monday_item_id: assignment.monday_item_id,
          wf_shift_id: wfResult.id,
          status: "success",
          monday_synced: mondaySynced,
        });
        successCount++;
        console.log(`[send-manual-shifts] ✅ Successfully sent shift for monday_item_id: ${assignment.monday_item_id}, monday_synced: ${mondaySynced}`);

      } catch (error: any) {
        console.error(`[send-manual-shifts] ❌ Error for monday_item_id ${assignment.monday_item_id}:`, error);
        results.push({
          monday_item_id: assignment.monday_item_id,
          wf_shift_id: null,
          status: "failed",
          monday_synced: false,
          error: error.message,
        });
        failedCount++;
      }
    }

    console.log(`[send-manual-shifts] Completed: ${successCount} success, ${failedCount} failed, ${mondaySyncedCount} monday synced`);

    return new Response(
      JSON.stringify({
        success: failedCount === 0,
        sent: successCount,
        failed: failedCount,
        monday_synced: mondaySyncedCount,
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