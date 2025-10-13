import { useState, useRef, useEffect } from 'react';
import { Brain } from 'lucide-react';
import { HeaderWithHistory } from '@/components/profsyn-ai/HeaderWithHistory';
import { ChatMessage } from '@/components/profsyn-ai/ChatMessage';
import { Composer } from '@/components/profsyn-ai/Composer';
import { ClearChatDialog } from '@/components/profsyn-ai/ClearChatDialog';
import { useProfSynAI } from '@/hooks/useProfSynAI';

const ProfSynAI = () => {
  const [showClearDialog, setShowClearDialog] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const {
    messages,
    isLoading,
    streaming,
    setStreaming,
    sendMessage,
    sessions,
    currentSession,
    loadSession,
    startNewChat,
    deleteSessionById,
  } = useProfSynAI();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (content: string, mode: 'text' | 'email' | 'objection') => {
    await sendMessage(content, mode);
  };

  const handleClearChat = () => {
    startNewChat();
    setShowClearDialog(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Fixed Header */}
      <HeaderWithHistory
        sessions={sessions}
        onLoadSession={loadSession}
        onDeleteSession={deleteSessionById}
        onNewChat={startNewChat}
      />

      {/* Scrollable Chat Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-24 animate-fade-in">
              <Brain className="h-20 w-20 text-primary mx-auto mb-6 opacity-80" />
              <h2 className="text-3xl font-bold mb-3 text-foreground">
                Velkommen til ProfSyn AI
              </h2>
              <p className="text-muted-foreground text-lg max-w-md mx-auto">
                Stil et spørgsmål, forbedr en tekst, eller forbered en email.
              </p>
            </div>
          ) : (
            messages.map((message, index) => (
              <ChatMessage key={index} message={message} />
            ))
          )}
          
          {isLoading && (
            <div className="flex items-start gap-3 animate-fade-in">
              <div className="bg-muted rounded-2xl px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="flex gap-1">
                    <span className="animate-bounce inline-block w-1.5 h-1.5 bg-current rounded-full"></span>
                    <span className="animate-bounce inline-block w-1.5 h-1.5 bg-current rounded-full" style={{ animationDelay: '0.1s' }}></span>
                    <span className="animate-bounce inline-block w-1.5 h-1.5 bg-current rounded-full" style={{ animationDelay: '0.2s' }}></span>
                  </div>
                  <span className="text-sm ml-1">Skriver...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Sticky Composer */}
      <Composer
        onSend={handleSend}
        onClearChat={() => setShowClearDialog(true)}
        isLoading={isLoading}
        messages={messages}
      />

      {/* Footer */}
      <footer className="bg-muted/40 border-t mt-auto py-3">
        <div className="max-w-3xl mx-auto px-4 text-center text-xs text-muted-foreground space-y-1">
          <p>ProfSyn AI bruger OpenAI's teknologi. Brug ansvarligt.</p>
          <p>Indholdet er genereret af AI og udgør ikke juridisk rådgivning.</p>
        </div>
      </footer>

      <ClearChatDialog
        open={showClearDialog}
        onOpenChange={setShowClearDialog}
        onConfirm={handleClearChat}
      />
    </div>
  );
};

export default ProfSynAI;
