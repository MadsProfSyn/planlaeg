import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { queryProfSynAI, parseCSVFile, CSVData } from '@/lib/profsyn-ai';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function useProfSynAI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streaming, setStreaming] = useState(true);
  const [csvData, setCsvData] = useState<CSVData | null>(null);
  const { toast } = useToast();

  const sendMessage = useCallback(
    async (content: string, mode: 'text' | 'data' | 'actions') => {
      if (!content.trim()) return;

      const userMessage: Message = { role: 'user', content };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const csvPreview = csvData
          ? {
              headers: csvData.headers,
              rowCount: csvData.rowCount,
            }
          : undefined;

        const response = await queryProfSynAI({
          messages: [...messages, userMessage],
          mode,
          csvPreview,
          streaming,
        });

        if (streaming && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let assistantContent = '';

          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: '' },
          ]);

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
                    setMessages((prev) => {
                      const newMessages = [...prev];
                      newMessages[newMessages.length - 1].content = assistantContent;
                      return newMessages;
                    });
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        } else {
          const data = await response.json();
          const assistantMessage: Message = {
            role: 'assistant',
            content: data.choices[0].message.content,
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }
      } catch (error) {
        console.error('Error sending message:', error);
        toast({
          title: 'Fejl',
          description: 'Der opstod en fejl. Prøv igen senere.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [messages, csvData, streaming, toast]
  );

  const uploadCSV = useCallback(
    async (file: File) => {
      try {
        const data = await parseCSVFile(file);
        setCsvData(data);
        toast({
          title: 'CSV uploadet',
          description: `${data.rowCount} rækker og ${data.headers.length} kolonner indlæst`,
        });
      } catch (error) {
        console.error('Error parsing CSV:', error);
        toast({
          title: 'Fejl',
          description: 'Kunne ikke læse CSV-filen. Tjek formatet.',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  const clearCSV = useCallback(() => {
    setCsvData(null);
    toast({
      title: 'Data ryddet',
      description: 'CSV-data er blevet fjernet',
    });
  }, [toast]);

  const clearConversation = useCallback(() => {
    setMessages([]);
    toast({
      title: 'Samtale ryddet',
      description: 'Alle beskeder er blevet slettet',
    });
  }, [toast]);

  const executeAction = useCallback(
    async (action: 'summarize' | 'extract' | 'plan') => {
      const actionPrompts = {
        summarize: 'Lav en kort opsummering af vores samtale indtil nu.',
        extract: 'Udtræk de vigtigste punkter fra vores samtale i punktform.',
        plan: 'Baseret på vores samtale, lav en handlingsplan med konkrete trin.',
      };

      await sendMessage(actionPrompts[action], 'actions');
    },
    [sendMessage]
  );

  return {
    messages,
    isLoading,
    streaming,
    setStreaming,
    csvData,
    sendMessage,
    uploadCSV,
    clearCSV,
    clearConversation,
    executeAction,
  };
}
