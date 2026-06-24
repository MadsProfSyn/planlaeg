import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Convert UTC timestamp to Copenhagen local time
function toCopenhagenTime(utcDateTimeStr) {
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
function calculateDuration(startUtc, endUtc) {
  const start = new Date(startUtc);
  const end = new Date(endUtc);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
}

// Extract address from comment message (first line)
function extractAddress(comment) {
  if (!comment || !comment.message) return null;
  const firstLine = comment.message.split("\n")[0].trim();
  if (firstLine.length > 5) {
    return firstLine;
  }
  return null;
}

// Normalize address for cache lookup
function normalizeAddress(address: string): string {
  return `${stripFloorDoor(address).toLowerCase().trim()}, danmark`;
}

// Removes Danish floor/door segments like ", 1. 11" / ", 6. th" / ", st. tv" / ", 2. sal" / ", 3. mf"
function stripFloorDoor(address: string): string {
  return address
    .replace(/,\s*(st\.?|kl\.?|\d+\.?)\s*(tv|th|mf|mid|sal|\.?\s*\d+)?(?=,|$)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Geocode an address using Mapbox with caching
const MAPBOX_TOKEN = Deno.env.get("MAPBOX_TOKEN");

async function geocodeAddress(
  supabase: ReturnType<typeof createClient>,
  address: string
): Promise<{ lat: number; lng: number } | null> {
  if (!address || !MAPBOX_TOKEN) return null;

  const normalizedAddress = normalizeAddress(address);

  // Check cache first
  const { data: cached } = await supabase
    .from("mapbox_coords_cache")
    .select("lat, lon")
    .eq("normalized_address", normalizedAddress)
    .maybeSingle();

  if (cached?.lat && cached?.lon) {
    return { lat: cached.lat, lng: cached.lon };
  }

  // Not cached - call Mapbox
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(normalizedAddress)}.json?access_token=${MAPBOX_TOKEN}&country=DK&limit=1`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;

      // Cache the result
      await supabase.from("mapbox_coords_cache").upsert({
        normalized_address: normalizedAddress,
        lat: lat,
        lon: lng,
        updated_at: new Date().toISOString(),
      }, { onConflict: "normalized_address" });

      return { lat, lng };
    }
  } catch (error) {
    console.error(`Geocoding error for "${address}":`, error);
  }

  return null;
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

    const { startDate, endDate } = await req.json();

    // Default to today + 90 days ahead (extended from 45 for better future coverage)
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const ninetyDaysLater = new Date();
    ninetyDaysLater.setDate(ninetyDaysLater.getDate() + 90);
    const defaultEndDate = ninetyDaysLater.toISOString().split("T")[0];

    const fromDate = startDate || todayStr;
    const toDate = endDate || defaultEndDate;

    console.log(`Syncing shifts for ${fromDate} to ${toDate} (CLEAN-SLATE mode)`);

    // Build inspector lookup map
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

    // Load department mappings
    console.log("Loading department mappings...");
    const { data: departments } = await supabaseClient.from("departments").select("wf_department_id, name");

    const departmentMap = new Map();
    for (const dept of departments || []) {
      departmentMap.set(dept.wf_department_id, dept.name);
    }
    console.log(`Loaded ${departmentMap.size} department mappings`);

    // Load role mappings
    console.log("Loading role mappings...");
    const { data: roleMappings } = await supabaseClient.from("role_mappings").select("wf_role_id, wf_role_name");

    const roleMap = new Map();
    for (const role of roleMappings || []) {
      roleMap.set(role.wf_role_id, role.wf_role_name);
    }
    console.log(`Loaded ${roleMap.size} role mappings`);

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

    // CLEAN-SLATE: Delete all existing shifts for this date range
    console.log(`Deleting existing shifts from ${fromDate} to ${toDate}...`);
    const { error: deleteError } = await supabaseClient
      .from("supabase_shifts")
      .delete()
      .gte("date_local", fromDate)
      .lte("date_local", toDate);

    if (deleteError) {
      console.error("Failed to delete existing shifts:", deleteError);
      throw new Error(`Failed to delete existing shifts: ${deleteError.message}`);
    }
    console.log("Successfully deleted existing shifts for date range");

    let synced = 0;
    let unmapped = 0;
    let errors = 0;
    let addressesExtracted = 0;
    let geocoded = 0;

    // Process each shift from WorkFeed
    for (const shift of workfeedData) {
      try {
        // Skip unassigned shifts
        if (!shift.employeeID) {
          console.warn(`Shift ${shift.id} missing employeeID - skipping (unassigned)`);
          unmapped++;
          continue;
        }

        // Look up inspector
        const inspector = inspectorMap.get(shift.employeeID);
        if (!inspector) {
          console.warn(`No inspector found for wf_employee_id: ${shift.employeeID} (shift: ${shift.id})`);
          unmapped++;
          continue;
        }

        // Convert times
        let startTimeLocal = null;
        let endTimeLocal = null;
        let duration = null;

        if (shift.start && shift.end) {
          try {
            startTimeLocal = toCopenhagenTime(shift.start);
            endTimeLocal = toCopenhagenTime(shift.end);
            duration = calculateDuration(shift.start, shift.end);
          } catch (timeError) {
            console.error("Error converting times:", timeError);
          }
        }

        // Extract date
        const dateLocal = shift.start ? shift.start.split("T")[0] : fromDate;

        // Get mappings
        const departmentName = departmentMap.get(shift.departmentID) || "Unknown";
        const roleAbbreviation = roleMap.get(shift.roleID) || "Unknown";

        // Extract address
        const address = extractAddress(shift.comment);
        if (address) {
          addressesExtracted++;
        }

        // Geocode the address
        let coords: { lat: number; lng: number } | null = null;
        if (address) {
          coords = await geocodeAddress(supabaseClient, address);
          if (coords) {
            geocoded++;
          }
          // Rate limiting: 100ms delay between geocoding calls
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Prepare shift data
        const shiftData = {
          wf_shift_id: shift.id,
          wf_employee_id: shift.employeeID,
          inspector_id: inspector.id,
          inspector_name: inspector.name,
          department: departmentName,
          type: roleAbbreviation,
          status: shift.released ? "RELEASED" : "ASSIGNED",
          date_local: dateLocal,
          start_utc: shift.start || null,
          end_utc: shift.end || null,
          start_time_local: startTimeLocal,
          end_time_local: endTimeLocal,
          duration_minutes: duration,
          wf_role_id: shift.roleID || null,
          address: address,
          lat: coords?.lat || null,
          lng: coords?.lng || null,
        };

        // Insert the shift
        const { error: insertError } = await supabaseClient.from("supabase_shifts").insert(shiftData);

        if (insertError) {
          console.error("Error inserting shift:", insertError);
          errors++;
        } else {
          synced++;
          if (synced <= 3) {
            console.log(`✓ Synced ${roleAbbreviation} shift for ${inspector.name} at ${address || "no address"}`);
          }
        }
      } catch (shiftError) {
        console.error("Error processing shift:", shiftError);
        errors++;
      }
    }

    const response = {
      success: true,
      synced,
      unmapped,
      errors,
      addressesExtracted,
      geocoded,
      total: workfeedData.length || 0,
      dateRange: {
        from: fromDate,
        to: toDate,
      },
      summary: `Synced ${synced} shifts (${addressesExtracted} with addresses, ${geocoded} geocoded), ${unmapped} unmapped, ${errors} errors`,
    };

    console.log("Sync completed:", response);

    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error in sync-workfeed-shifts function:", error);

    const errorResponse = {
      success: false,
      synced: 0,
      unmapped: 0,
      errors: 1,
      addressesExtracted: 0,
      total: 0,
      dateRange: { from: "", to: "" },
      summary: "Sync failed",
      error: error instanceof Error ? error.message : "Unknown error",
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
