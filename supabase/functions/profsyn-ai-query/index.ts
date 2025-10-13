import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, mode, csvPreview, streaming } = await req.json();

    // Validation
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Ugyldige beskeder' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!openAIApiKey) {
      return new Response(
        JSON.stringify({ error: 'API-nøgle mangler' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build system prompt based on mode
    let systemPrompt = 'Du er ProfSyn AI, en hjælpsom assistent. Svar på dansk med mindre andet er angivet.';
    
    if (mode === 'data' && csvPreview) {
      systemPrompt += `\n\nBrugeren har uploadet CSV-data med følgende struktur:\nKolonner: ${csvPreview.headers.join(', ')}\nAntal rækker: ${csvPreview.rowCount}\n\nBesvar spørgsmål om disse data.`;
    } else if (mode === 'actions') {
      systemPrompt += '\n\nUdfør den anmodede handling: opsummer samtalen, udtræk punkter, eller lav en handlingsplan.';
    }

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    console.log('Calling OpenAI with mode:', mode, 'streaming:', streaming);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini-2025-04-14',
        messages: apiMessages,
        temperature: 0.7,
        max_completion_tokens: 2000,
        stream: streaming,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'For mange anmodninger. Prøv igen om et øjeblik.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'OpenAI kvote opbrugt. Kontakt support.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Der opstod en fejl med AI-anmodningen' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (streaming) {
      return new Response(response.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
        },
      });
    } else {
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error in profsyn-ai-query:', error);
    return new Response(
      JSON.stringify({ error: 'Der opstod en fejl. Prøv igen senere.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
