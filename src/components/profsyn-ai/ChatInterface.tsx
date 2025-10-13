import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trash2, MessageSquare } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatInterfaceProps {
  messages: Message[];
  isLoading: boolean;
  onClearChat: () => void;
}

export function ChatInterface({ messages, isLoading, onClearChat }: ChatInterfaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Samtale
        </h2>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearChat}
            className="text-muted-foreground"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Ryd samtale
          </Button>
        )}
      </div>

      <ScrollArea className="h-[500px]" ref={scrollRef}>
        <div className="space-y-4 pr-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground">
              <p>Stil et spørgsmål for at komme i gang</p>
            </div>
          ) : (
            messages.map((message, index) => (
              <MessageBubble key={index} message={message} />
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
      </ScrollArea>
    </Card>
  );
}
