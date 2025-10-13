import { useState } from 'react';
import { Brain } from 'lucide-react';
import { ChatInterface } from '@/components/profsyn-ai/ChatInterface';
import { ChatInput } from '@/components/profsyn-ai/ChatInput';
import { QuickPrompts } from '@/components/profsyn-ai/QuickPrompts';
import { ToolsPanel } from '@/components/profsyn-ai/ToolsPanel';
import { ClearChatDialog } from '@/components/profsyn-ai/ClearChatDialog';
import { useProfSynAI } from '@/hooks/useProfSynAI';

const ProfSynAI = () => {
  const [showClearDialog, setShowClearDialog] = useState(false);
  const {
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
  } = useProfSynAI();

  const handleSend = async (content: string) => {
    await sendMessage(content, csvData ? 'data' : 'text');
  };

  const handleQuickPrompt = (prompt: string) => {
    sendMessage(prompt, 'text');
  };

  const handleAction = async (action: 'summarize' | 'extract' | 'plan') => {
    await executeAction(action);
  };

  const handleClearChat = () => {
    clearConversation();
    setShowClearDialog(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary/10 via-background to-primary/5 border-b">
        <div className="container mx-auto px-4 py-12">
          <div className="flex items-center gap-3 justify-center mb-4">
            <Brain className="h-12 w-12 text-primary" />
            <h1 className="text-4xl font-bold">ProfSyn AI</h1>
          </div>
          <p className="text-xl font-semibold text-center mb-2">
            Spørg. Analyser. Handl.
          </p>
          <p className="text-center text-muted-foreground max-w-2xl mx-auto">
            Din AI-assistent drevet af OpenAI – klar til at hjælpe dig med tekst, data og indsigt.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chat Section - 2/3 width */}
          <div className="lg:col-span-2 space-y-4">
            <ChatInterface 
              messages={messages} 
              isLoading={isLoading}
              onClearChat={() => setShowClearDialog(true)}
            />
            
            <QuickPrompts onSelectPrompt={handleQuickPrompt} />
            
            <ChatInput
              onSend={handleSend}
              isLoading={isLoading}
              streaming={streaming}
              onStreamingChange={setStreaming}
            />
          </div>

          {/* Tools Panel - 1/3 width */}
          <div className="lg:col-span-1">
            <ToolsPanel
              csvData={csvData}
              onUploadCSV={uploadCSV}
              onClearCSV={clearCSV}
              onExecuteAction={handleAction}
              hasMessages={messages.length > 0}
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t mt-16 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>ProfSyn AI bruger OpenAI's teknologi. Brug ansvarligt.</p>
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
