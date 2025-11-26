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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { inspector_ids, target_date, message_template }: SendSmsRequest = await req.json();

    console.log(`Sending SMS reminders to ${inspector_ids.length} inspectors for date ${target_date}`);

    // Default template if none provided
    const template = message_template || `Hej {first_name}

Vi mangler hjælp til {date}, og du har ikke taget stilling i WorkFeed, hvorvidt du kan tage syn.

Denne SMS kan ikke besvares.

Ved spørgsmål henvend dig direkte til ProfSyn.
Mvh
ProfSyn`;

    // Get Twilio credentials
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");

    if (!accountSid || !authToken) {
      throw new Error("Twilio credentials not configured");
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch inspector details
    const { data: inspectors, error: fetchError } = await supabase
      .from("inspectors")
      .select("id, first_name, full_name, phone")
      .in("id", inspector_ids)
      .eq("is_active", true);

    if (fetchError) {
      throw new Error(`Failed to fetch inspectors: ${fetchError.message}`);
    }

    if (!inspectors || inspectors.length === 0) {
      return new Response(
        JSON.stringify({ error: "No inspectors found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Format date in Danish
    const formattedDate = new Date(target_date).toLocaleDateString("da-DK", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Send SMS to each inspector
    const results: SendResult = { sent: 0, failed: 0, skipped: 0, details: [] };

    for (const inspector of inspectors) {
      const firstName = inspector.first_name || inspector.full_name.split(" ")[0];

      // Skip if no phone number
      if (!inspector.phone) {
        results.skipped++;
        results.details.push({
          inspector_id: inspector.id,
          inspector_name: inspector.full_name,
          status: "skipped",
          reason: "No phone number",
        });
        console.log(`Skipped ${inspector.full_name} - no phone number`);
        continue;
      }

      // Format phone number with +45 prefix
      const phoneNumber = `+45${inspector.phone}`;

      // Build SMS message by replacing placeholders
      const message = template
        .replace(/{first_name}/g, firstName)
        .replace(/{date}/g, formattedDate);

      try {
        // Send via Twilio API
        const twilioResponse = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
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
          }
        );

        if (twilioResponse.ok) {
          const twilioData = await twilioResponse.json();
          results.sent++;
          results.details.push({
            inspector_id: inspector.id,
            inspector_name: inspector.full_name,
            status: "sent",
          });
          console.log(`SMS sent to ${inspector.full_name} (${phoneNumber}), SID: ${twilioData.sid}`);
        } else {
          const errorData = await twilioResponse.json();
          results.failed++;
          results.details.push({
            inspector_id: inspector.id,
            inspector_name: inspector.full_name,
            status: "failed",
            reason: errorData.message || "Twilio API error",
          });
          console.error(`Failed to send SMS to ${inspector.full_name}:`, errorData);
        }
      } catch (error) {
        results.failed++;
        results.details.push({
          inspector_id: inspector.id,
          inspector_name: inspector.full_name,
          status: "failed",
          reason: error.message,
        });
        console.error(`Error sending SMS to ${inspector.full_name}:`, error);
      }
    }

    console.log(`SMS sending complete: ${results.sent} sent, ${results.failed} failed, ${results.skipped} skipped`);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in send-sms-reminder function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
