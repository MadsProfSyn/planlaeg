// Workfeed Shifts Sync - Last updated: 2025-01-22
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Convert UTC timestamp to Copenhagen local time
function toCopenhagenTime(utcDateTimeStr: string): string {
  const date = new Date(utcDateTimeStr);
  const copenhagenStr = date.toLocaleString("en-US", {
    timeZone: "Europe/Copenhagen",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return copenhagenStr.split(", ")[1] || copenhagenStr;
}

// Calculate duration in minutes between two UTC timestamps
function calculateDuration(startUtc: string, endUtc: string): number {
  const start = new Date(startUtc);
  const end = new Date(endUtc);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { startDate, endDate, forceSync = false } = await req.json();

    // Default to today + 30 days ahead
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    const defaultEndDate = thirtyDaysLater.toISOString().split("T")[0];

    const fromDate = startDate || todayStr;
    const toDate = endDate || defaultEndDate;

    console.log(`Syncing shifts for ${fromDate} to ${toDate}, forceSync: ${forceSync}`);

    // Build inspector lookup map: wf_employee_id -> inspector details
    console.log("Loading inspector mappings...");
    const { data: inspectors, error: inspectorsError } = await supabaseClient
      .from("inspectors")
      .select("id, full_name, wf_employee_id")
      .not("wf_employee_id", "is", null);

    if (inspectorsError) {
      throw new Error(`Failed to load inspectors: ${inspectorsError.message}`);
    }

    const inspectorMap = new Map();
    for (const inspector of inspectors || []) {
      inspectorMap.set(inspector.wf_employee_id, {
        id: inspector.id,
        name: inspector.full_name,
      });
    }

    console.log(`Loaded ${inspectorMap.size} inspector mappings`);

    // Load department mappings (roleID -> role name, departmentID -> dept name)
    const { data: departments } = await supabaseClient.from("workfeed_departments").select("wf_department_id, name");

    const departmentMap = new Map();
    for (const dept of departments || []) {
      departmentMap.set(dept.wf_department_id, dept.name);
    }

    // Fetch shifts from Workfeed API
    const workfeedApiKey = Deno.env.get("WORKFEED_API_KEY");
    const workfeedCompanyId = Deno.env.get("WORKFEED_COMPANY_ID") || "KASqUqisoJTrzapASxwG";

    if (!workfeedApiKey) {
      throw new Error("WORKFEED_API_KEY is not configured");
    }

    const startFromISO = `${fromDate}T00:00:00.000Z`;
    const startToISO = `${toDate}T23:59:59.999Z`;

    const workfeedUrl = `https://europe-west1-production-eu-327a3.cloudfunctions.net/api/companies/${workfeedCompanyId}/shifts?startFrom=${startFromISO}&startTo=${startToISO}`;

    console.log("Fetching from Workfeed:", workfeedUrl);

    const workfeedResponse = await fetch(workfeedUrl, {
      method: "GET",
      headers: {
        Authorization: workfeedApiKey,
        "Content-Type": "application/json",
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
    let unmapped = 0;

    // Process each shift
    for (const shift of workfeedData) {
      try {
        // Debug: Log shift structure for first 2 shifts
        if (synced + skipped + unmapped + errors < 2) {
          console.log(
            "DEBUG - Raw shift data:",
            JSON.stringify(
              {
                id: shift.id,
                employeeID: shift.employeeID,
                roleID: shift.roleID,
                departmentID: shift.departmentID,
                start: shift.start,
                end: shift.end,
                status: shift.status,
                availableFields: Object.keys(shift),
              },
              null,
              2,
            ),
          );
        }

        // Skip if no employeeID (capital ID!)
        if (!shift.employeeID) {
          console.warn(`Shift ${shift.id} missing employeeID - skipping (unassigned shift)`);
          unmapped++;
          continue;
        }

        // Look up inspector by wf_employee_id
        const inspector = inspectorMap.get(shift.employeeID);
        if (!inspector) {
          console.warn(`No inspector found for wf_employee_id: ${shift.employeeID} (shift: ${shift.id})`);
          unmapped++;
          continue;
        }

        // Check if shift already exists (unless forcing sync)
        if (!forceSync && shift.id) {
          const { data: existing } = await supabaseClient
            .from("supabase_shifts")
            .select("id")
            .eq("wf_shift_id", shift.id)
            .maybeSingle();

          if (existing) {
            skipped++;
            continue;
          }
        }

        // Convert UTC times to Copenhagen local times
        let startTimeLocal = null;
        let endTimeLocal = null;
        let duration = null;

        // Use 'start' and 'end' fields (not startDateTime/endDateTime)
        if (shift.start && shift.end) {
          try {
            startTimeLocal = toCopenhagenTime(shift.start);
            endTimeLocal = toCopenhagenTime(shift.end);
            duration = calculateDuration(shift.start, shift.end);
          } catch (timeError) {
            console.error("Error converting times:", timeError);
          }
        }

        // Extract date_local from start timestamp
        const dateLocal = shift.start ? shift.start.split("T")[0] : fromDate;

        // Get department name from map
        const departmentName = departmentMap.get(shift.departmentID) || "Unknown";

        // Prepare shift data
        const shiftData = {
          wf_shift_id: shift.id,
          wf_employee_id: shift.employeeID,
          inspector_id: inspector.id,
          inspector_name: inspector.name,
          department: departmentName,
          type: shift.roleID || "Unknown", // Will store roleID for now
          status: shift.released ? "RELEASED" : "ASSIGNED",
          date_local: dateLocal,
          start_utc: shift.start || null,
          end_utc: shift.end || null,
          start_time_local: startTimeLocal,
          end_time_local: endTimeLocal,
          duration_minutes: duration,
          wf_role_id: shift.roleID || null,
          address: null, // Not provided in this API response
        };

        // Debug: Log prepared data for first successful shift
        if (synced === 0) {
          console.log("DEBUG - Prepared shift data:", JSON.stringify(shiftData, null, 2));
        }

        // Upsert the shift
        const { error: upsertError } = await supabaseClient.from("supabase_shifts").upsert(shiftData, {
          onConflict: "wf_shift_id",
          ignoreDuplicates: false,
        });

        if (upsertError) {
          console.error("Error upserting shift:", upsertError);
          errors++;
        } else {
          synced++;
          console.log(`✓ Synced shift for ${inspector.name} on ${dateLocal} (${startTimeLocal}-${endTimeLocal})`);
        }
      } catch (shiftError) {
        console.error("Error processing shift:", shiftError);
        errors++;
      }
    }

    const response = {
      success: true,
      synced,
      skipped,
      unmapped,
      errors,
      total: workfeedData.length || 0,
      dateRange: { from: fromDate, to: toDate },
      summary: `Synced ${synced} shifts, skipped ${skipped}, ${unmapped} unmapped, ${errors} errors`,
    };

    console.log("Sync completed:", response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in sync-workfeed-shifts function:", error);

    const errorResponse = {
      success: false,
      synced: 0,
      skipped: 0,
      unmapped: 0,
      errors: 1,
      total: 0,
      dateRange: { from: "", to: "" },
      summary: "Sync failed",
      error: error instanceof Error ? error.message : "Unknown error",
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
