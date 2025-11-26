import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendSmsRequest {
  inspector_ids: string[];
  target_date: string;
  message_template?: string;
}

interface SendResult {
  sent: number;
  failed: number;
  skipped: number;
  details: Array<{
    inspector_id: string;
    inspector_name: string;
    status: "sent" | "failed" | "skipped";
    reason?: string;
  }>;
}

serve(async (req) => {
  console.log("=== SMS Reminder Edge Function Started ===");

  if (req.method === "OPTIONS") {
    console.log("Handling CORS preflight request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { inspector_ids, target_date, message_template }: SendSmsRequest = requestBody;

    console.log(`[REQUEST] Sending SMS reminders to ${inspector_ids.length} inspectors for date ${target_date}`);
    console.log(`[REQUEST] Inspector IDs: ${inspector_ids.join(", ")}`);
    console.log(`[REQUEST] Custom template provided: ${!!message_template}`);

    // Default template if none provided
    const template =
      message_template ||
      `Hej {first_name}

Vi mangler hjælp til {date}, og du har ikke taget stilling i WorkFeed, hvorvidt du kan tage syn.

Denne SMS kan ikke besvares.

Ved spørgsmål henvend dig direkte på mail eller tlf. 
Mvh
ProfSyn`;

    console.log(`[TEMPLATE] Using template with ${template.length} characters`);

    // Get Twilio credentials
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");

    console.log(`[TWILIO] Account SID present: ${!!accountSid}`);
    console.log(`[TWILIO] Auth Token present: ${!!authToken}`);
    if (accountSid) {
      console.log(`[TWILIO] Account SID starts with: ${accountSid.substring(0, 8)}...`);
    }

    if (!accountSid || !authToken) {
      console.error("[ERROR] Twilio credentials not configured");
      throw new Error("Twilio credentials not configured");
    }

    // Create Supabase client
    console.log("[SUPABASE] Creating Supabase client");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch inspector details
    console.log(`[DATABASE] Fetching details for ${inspector_ids.length} inspectors`);
    const { data: inspectors, error: fetchError } = await supabase
      .from("inspectors")
      .select("id, first_name, full_name, phone")
      .in("id", inspector_ids)
      .eq("is_active", true);

    if (fetchError) {
      console.error("[DATABASE ERROR] Failed to fetch inspectors:", fetchError);
      throw new Error(`Failed to fetch inspectors: ${fetchError.message}`);
    }

    console.log(`[DATABASE] Found ${inspectors?.length || 0} active inspectors`);

    if (!inspectors || inspectors.length === 0) {
      console.warn("[WARNING] No inspectors found for the provided IDs");
      return new Response(JSON.stringify({ error: "No inspectors found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format date in Danish (without year)
    const formattedDate = new Date(target_date).toLocaleDateString("da-DK", {
      day: "numeric",
      month: "long",
    });
    console.log(`[DATE] Formatted date: ${formattedDate}`);

    // Send SMS to each inspector
    const results: SendResult = { sent: 0, failed: 0, skipped: 0, details: [] };

    console.log(`[SMS] Starting to process ${inspectors.length} inspectors`);

    for (const inspector of inspectors) {
      console.log(`[SMS] Processing inspector: ${inspector.full_name} (ID: ${inspector.id})`);

      const firstName = inspector.first_name || inspector.full_name.split(" ")[0];
      console.log(`[SMS] Using first name: ${firstName}`);

      // Skip if no phone number
      if (!inspector.phone) {
        results.skipped++;
        results.details.push({
          inspector_id: inspector.id,
          inspector_name: inspector.full_name,
          status: "skipped",
          reason: "No phone number",
        });
        console.warn(`[SKIP] ${inspector.full_name} - no phone number`);
        continue;
      }

      // Format phone number with +45 prefix
      const phoneNumber = `+45${inspector.phone}`;
      console.log(`[SMS] Formatted phone: ${phoneNumber}`);

      // Build SMS message by replacing placeholders
      const message = template.replace(/{first_name}/g, firstName).replace(/{date}/g, formattedDate);

      console.log(`[SMS] Message length: ${message.length} characters`);

      try {
        console.log(`[TWILIO] Sending SMS to ${inspector.full_name}`);
        console.log(`[TWILIO] Request URL: https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`);

        // Send via Twilio API
        const twilioResponse = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            From: "ProfSyn",
            To: phoneNumber,
            Body: message,
          }),
        });

        console.log(`[TWILIO] Response status: ${twilioResponse.status} ${twilioResponse.statusText}`);

        if (twilioResponse.ok) {
          const twilioData = await twilioResponse.json();
          results.sent++;
          results.details.push({
            inspector_id: inspector.id,
            inspector_name: inspector.full_name,
            status: "sent",
          });
          console.log(`[SUCCESS] SMS sent to ${inspector.full_name} (${phoneNumber})`);
          console.log(`[SUCCESS] Twilio SID: ${twilioData.sid}`);
          console.log(`[SUCCESS] Status: ${twilioData.status}`);
        } else {
          const errorData = await twilioResponse.json();
          results.failed++;
          results.details.push({
            inspector_id: inspector.id,
            inspector_name: inspector.full_name,
            status: "failed",
            reason: errorData.message || "Twilio API error",
          });
          console.error(`[TWILIO ERROR] Failed to send SMS to ${inspector.full_name}`);
          console.error(`[TWILIO ERROR] Status: ${twilioResponse.status}`);
          console.error(`[TWILIO ERROR] Error code: ${errorData.code}`);
          console.error(`[TWILIO ERROR] Message: ${errorData.message}`);
          console.error(`[TWILIO ERROR] More info: ${errorData.more_info}`);
          console.error(`[TWILIO ERROR] Full error data:`, JSON.stringify(errorData, null, 2));
        }
      } catch (error) {
        results.failed++;
        results.details.push({
          inspector_id: inspector.id,
          inspector_name: inspector.full_name,
          status: "failed",
          reason: error.message,
        });
        console.error(`[EXCEPTION] Error sending SMS to ${inspector.full_name}:`, error);
        console.error(`[EXCEPTION] Error type: ${error.constructor.name}`);
        console.error(`[EXCEPTION] Error message: ${error.message}`);
        console.error(`[EXCEPTION] Stack trace:`, error.stack);
      }
    }

    console.log("=== SMS Sending Complete ===");
    console.log(
      `[SUMMARY] Total: ${inspectors.length}, Sent: ${results.sent}, Failed: ${results.failed}, Skipped: ${results.skipped}`,
    );

    console.log("[RESPONSE] Returning results to client");
    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("=== CRITICAL ERROR ===");
    console.error("[ERROR] Function encountered an error:", error);
    console.error("[ERROR] Error type:", error.constructor.name);
    console.error("[ERROR] Error message:", error.message);
    console.error("[ERROR] Stack trace:", error.stack);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
