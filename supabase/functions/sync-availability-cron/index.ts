import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  try {
    // Calculate date range: today + 45 days ahead
    const today = new Date();
    const fortyFiveDaysAhead = new Date(today);
    fortyFiveDaysAhead.setDate(today.getDate() + 45);

    const from = today.toISOString();
    const to = fortyFiveDaysAhead.toISOString();

    console.log(`[sync-availability-cron] Running scheduled sync from ${from} to ${to}`);

    // Call the main ingest function
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
    }

    const ingestUrl = `${SUPABASE_URL}/functions/v1/workfeed-ingest-availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

    console.log(`[sync-availability-cron] Calling: ${ingestUrl}`);

    const response = await fetch(ingestUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok) {
      console.error(`[sync-availability-cron] Sync failed:`, result);
      throw new Error(`Sync failed: ${JSON.stringify(result)}`);
    }

    console.log(`[sync-availability-cron] Sync completed successfully:`, result);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced availability for ${from} to ${to}`,
        result,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[sync-availability-cron] Error:", error);
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
