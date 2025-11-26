import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  try {
    // Calculate date range: today + 45 days ahead
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const fortyFiveDaysAhead = new Date(today);
    fortyFiveDaysAhead.setDate(today.getDate() + 45);
    const endDateStr = fortyFiveDaysAhead.toISOString().split("T")[0];

    console.log(`[sync-shifts-cron] Running scheduled sync from ${todayStr} to ${endDateStr}`);

    // Call the main sync-workfeed-shifts function
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
    }

    const syncUrl = `${SUPABASE_URL}/functions/v1/sync-workfeed-shifts`;

    console.log(`[sync-shifts-cron] Calling: ${syncUrl}`);

    const response = await fetch(syncUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: todayStr,
        endDate: endDateStr,
        // Removed forceSync - not needed with clean-slate approach
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error(`[sync-shifts-cron] Sync failed:`, result);
      throw new Error(`Sync failed: ${JSON.stringify(result)}`);
    }

    console.log(`[sync-shifts-cron] Sync completed successfully:`, result);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced shifts for ${todayStr} to ${endDateStr}`,
        result,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[sync-shifts-cron] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
