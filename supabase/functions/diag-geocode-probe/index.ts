import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mirror of the live stripFloorDoor used by sync-workfeed-shifts and geocode-monday-items.
function stripFloorDoor(address: string): string {
  return address
    .replace(/,\s*(st\.?|kl\.?|\d+\.?)\s*(tv|th|mf|mid|sal|\.?\s*\d+)?(?=,|$)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
function normalizeAddress(address: string): string {
  return `${stripFloorDoor(address).toLowerCase().trim()}, danmark`;
}

function redact(url: string): string {
  return url.replace(/access_token=[^&]+/, "access_token=[REDACTED]");
}

async function probe(address: string, token: string) {
  const normalized = normalizeAddress(address);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(normalized)}.json?access_token=${token}&country=DK&limit=1`;
  const started = Date.now();
  const response = await fetch(url);
  const body = await response.text();
  return {
    input_address: address,
    normalized,
    final_url_redacted: redact(url),
    http_status: response.status,
    elapsed_ms: Date.now() - started,
    response_body: body.slice(0, 2000),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const token = Deno.env.get("MAPBOX_TOKEN");
  if (!token) {
    return new Response(JSON.stringify({ error: "MAPBOX_TOKEN missing at runtime" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const known_good_monday_address = "Gartnerbyen 53, 3. 5, 5200 Odense V";
  const failing_shift_address = "Hegnet 41, 4000 Roskilde";

  const monday_probe = await probe(known_good_monday_address, token);
  const shift_probe = await probe(failing_shift_address, token);

  const stripFloorDoor_samples = {
    "Strynøgade 5, 1. 105": stripFloorDoor("Strynøgade 5, 1. 105"),
    "Roskildevej 33A, 5. 601": stripFloorDoor("Roskildevej 33A, 5. 601"),
  };

  // Non-secret token fingerprint to confirm both probes used the same secret value
  // (length only; no token bytes leak).
  const token_fingerprint = { length: token.length, prefix: token.slice(0, 3) };

  return new Response(JSON.stringify({
    note: "Diagnostic only. No DB writes. Both probes use the same MAPBOX_TOKEN in the same invocation.",
    token_fingerprint,
    monday_probe,
    shift_probe,
    stripFloorDoor_samples,
  }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});