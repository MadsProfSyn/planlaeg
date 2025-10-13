import { useState, useCallback, useEffect } from "react";
import { queryProfSynAI } from "@/lib/profsyn-ai";
import { 
  getAllSessions, 
  saveSession, 
  deleteSession, 
  createNewSession, 
  generateTitle,
  type ChatSession,
  type Message 
} from "@/lib/chatHistory";

export function useProfSynAI() {
  const [currentSession, setCurrentSession] = useState<ChatSession>(createNewSession());
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streaming, setStreaming] = useState(true);

  useEffect(() => {
    setSessions(getAllSessions());
  }, []);

  const sendMessage = useCallback(
    async (content: string, mode: 'text' | 'email' | 'objection') => {
      if (!content.trim()) return;

      const userMessage: Message = { role: 'user', content };
      const newMessages = [...currentSession.messages, userMessage];
      
      // Update session with user message
      const updatedSession = {
        ...currentSession,
        messages: newMessages,
        lastUpdated: Date.now(),
        // Generate title from first user message
        title: currentSession.messages.length === 0 ? generateTitle(content) : currentSession.title
      };
      setCurrentSession(updatedSession);
      setIsLoading(true);

      try {
        const assistantMessage = await queryProfSynAI(
          newMessages,
          mode,
          streaming
        );

        const finalMessages: Message[] = [...newMessages, { role: 'assistant' as const, content: assistantMessage }];
        const finalSession: ChatSession = {
          ...updatedSession,
          messages: finalMessages,
          lastUpdated: Date.now()
        };
        
        setCurrentSession(finalSession);
        saveSession(finalSession);
        setSessions(getAllSessions());
      } catch (error) {
        console.error("Error querying AI:", error);
        const errorMessages: Message[] = [
          ...newMessages,
          { role: 'assistant' as const, content: 'Der opstod en fejl. Prøv igen.' }
        ];
        const errorSession: ChatSession = {
          ...updatedSession,
          messages: errorMessages,
          lastUpdated: Date.now()
        };
        setCurrentSession(errorSession);
      } finally {
        setIsLoading(false);
      }
    },
    [currentSession, streaming]
  );

  const loadSession = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSession(session);
    }
  }, [sessions]);

  const startNewChat = useCallback(() => {
    if (currentSession.messages.length > 0) {
      saveSession(currentSession);
      setSessions(getAllSessions());
    }
    const newSession = createNewSession();
    setCurrentSession(newSession);
  }, [currentSession]);

  const deleteSessionById = useCallback((sessionId: string) => {
    deleteSession(sessionId);
    setSessions(getAllSessions());
    if (currentSession.id === sessionId) {
      setCurrentSession(createNewSession());
    }
  }, [currentSession]);

  return {
    messages: currentSession.messages,
    isLoading,
    streaming,
    setStreaming,
    sendMessage,
    clearConversation: startNewChat,
    sessions,
    currentSession,
    loadSession,
    startNewChat,
    deleteSessionById,
  };
}
