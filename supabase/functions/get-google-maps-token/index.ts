const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get("GOOGLE_MAPS_API_KEY");

    if (!token) {
      throw new Error("Google Maps API key not configured");
    }

    return new Response(
      JSON.stringify({ token }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error fetching Google Maps API key:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to fetch Google Maps API key",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
