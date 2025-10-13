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
    const { messages, mode, streaming } = await req.json();

    // Validation
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Ugyldige beskeder' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate message length
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.content && lastMessage.content.length > 4000) {
      return new Response(
        JSON.stringify({ error: 'Beskeden er for lang. Max 4000 tegn.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!openAIApiKey) {
      return new Response(
        JSON.stringify({ error: 'API-nøgle mangler. Kontakt administratoren.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build system prompt based on mode
    let systemPrompt = 'Du er ProfSyn AI, en hjælpsom dansk AI-assistent.';
    
    if (mode === 'email') {
      systemPrompt = `Du er en professionel emailassistent. Din opgave er at forbedre brugerens tekst og formatere den som en klar, høflig dansk email.

Returner altid i dette format:
Emne: [kort, beskrivende emnelinje, max 8 ord]
Mail:
[Professionel, venlig og handlingsorienteret tekst. Brug korrekt dansk emailformat med hilsen, klar besked, og høflig afslutning]
Underskrift: —

Regler:
- Brug "du" medmindre bruger specifikt beder om "De"
- Vær præcis, men venlig
- Undgå unødvendige fraser
- Brug dansk etikette`;
    } else if (mode === 'objection') {
      systemPrompt = `Du er en juridisk assistent der hjælper med at strukturere indsigelser og klager.

Returner altid i dette format:
Titel: [max 8 ord, beskrivende]
Baggrund: [2-3 sætninger om situationen]
Problem: [Konkret beskrivelse af hvad der er galt]
Argumenter:
- [Hovedargument 1]
- [Hovedargument 2]
- [Hovedargument 3]
Anmodning: [Hvad ønskes konkret ændret eller opnået]
Næste skridt:
- [Praktisk handling 1]
- [Praktisk handling 2]

Regler:
- Brug faktuel, høflig tone
- Vær præcis og konkret
- Undgå juridisk jargon
- Fokuser på løsninger`;
    } else {
      systemPrompt += ' Svar på dansk med mindre andet er angivet.';
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
        model: 'gpt-4o-mini',
        messages: apiMessages,
        temperature: 0.3,
        max_completion_tokens: 900,
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
