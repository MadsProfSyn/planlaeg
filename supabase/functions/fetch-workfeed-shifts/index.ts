import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const workfeedApiKey = Deno.env.get('WORKFEED_API_KEY') || '9e70513b-8de2-4388-bfd0-5cab6a979f76';
    
    console.log('API Key from environment:', workfeedApiKey);
    console.log('API Key length:', workfeedApiKey?.length);
    console.log('API Key first 10 chars:', workfeedApiKey?.substring(0, 10));
    console.log('API Key last 10 chars:', workfeedApiKey?.substring(-10));

    const testUrl = 'https://europe-west1-production-eu-327a3.cloudfunctions.net/api/companies/KASqUqisoJTrzapASxwG/shifts?startFrom=2025-09-22T00:00:00.000Z&startTo=2025-09-23T23:59:59.999Z';
    
    console.log('Making request to:', testUrl);
    console.log('Authorization header will be:', `Bearer ${workfeedApiKey}`);

    const workfeedResponse = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${workfeedApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Response status:', workfeedResponse.status);
    console.log('Response headers:', Object.fromEntries(workfeedResponse.headers.entries()));

    if (workfeedResponse.ok) {
      const data = await workfeedResponse.json();
      return new Response(JSON.stringify({
        success: true,
        message: 'API call successful',
        shiftsCount: data.length,
        apiKeyLength: workfeedApiKey?.length,
        responseStatus: workfeedResponse.status
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      const errorText = await workfeedResponse.text();
      console.error('API Error:', errorText);
      
      return new Response(JSON.stringify({
        success: false,
        error: errorText,
        status: workfeedResponse.status,
        apiKeyUsed: workfeedApiKey,
        url: testUrl
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});