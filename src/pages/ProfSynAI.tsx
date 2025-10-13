import { useState } from 'react';
import { Brain } from 'lucide-react';
import { HeaderWithHistory } from '@/components/profsyn-ai/HeaderWithHistory';
import { ChatMessage } from '@/components/profsyn-ai/ChatMessage';
import { Composer } from '@/components/profsyn-ai/Composer';
import { ClearChatDialog } from '@/components/profsyn-ai/ClearChatDialog';
import { useProfSynAI } from '@/hooks/useProfSynAI';

const ProfSynAI = () => {
  const [showClearDialog, setShowClearDialog] = useState(false);
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
            <div className="text-center py-16">
              <Brain className="h-16 w-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Velkommen til ProfSyn AI</h2>
              <p className="text-muted-foreground">
                Stil et spørgsmål, forbedr en tekst, eller forbered en email.
              </p>
            </div>
          ) : (
            messages.map((message, index) => (
              <ChatMessage key={index} message={message} />
            ))
          )}
          
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="flex gap-1">
                <span className="animate-bounce">●</span>
                <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>●</span>
                <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>●</span>
              </div>
              <span className="text-sm">Skriver...</span>
            </div>
          )}
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
      <footer className="bg-muted/50 border-t py-3">
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
