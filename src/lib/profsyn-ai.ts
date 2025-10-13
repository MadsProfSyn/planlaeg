import { supabase } from "@/integrations/supabase/client";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export async function queryProfSynAI(
  messages: Message[],
  mode: 'text' | 'email' | 'objection',
  streaming: boolean = true
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  
  const response = await fetch(
    `https://wtkyxxfeubpadivllowr.supabase.co/functions/v1/profsyn-ai-query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`,
      },
      body: JSON.stringify({
        messages,
        mode,
        streaming,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Der opstod en fejl med AI-anmodningen');
  }

  if (streaming) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Streaming not supported');

    const decoder = new TextDecoder();
    let assistantContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }

    return assistantContent;
  } else {
    const data = await response.json();
    return data.choices[0].message.content;
  }
}
