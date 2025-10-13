import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Send, Sparkles, BookOpen, Mail, AlertCircle, Trash2 } from 'lucide-react';
import type { Message } from '@/lib/chatHistory';

interface ComposerProps {
  onSend: (content: string, mode: 'text' | 'email' | 'objection') => void;
  onClearChat: () => void;
  isLoading: boolean;
  messages: Message[];
}

export function Composer({ onSend, onClearChat, isLoading, messages }: ComposerProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSend = (mode: 'text' | 'email' | 'objection') => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    
    onSend(trimmed, mode);
    setInput('');
  };

  const handleQuickPrompt = (prompt: string) => {
    if (isLoading) return;
    onSend(prompt, 'text');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend('text');
    }
  };

  return (
    <Card className="sticky bottom-0 bg-background border-t shadow-lg">
      <div className="max-w-3xl mx-auto p-4 space-y-3">
        {/* Textarea */}
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Skriv din besked…"
          className="min-h-[80px] max-h-[200px] resize-none"
          disabled={isLoading}
        />
        
        {/* Action Buttons Row */}
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={() => handleSend('text')}
            disabled={!input.trim() || isLoading}
          >
            <Send className="h-4 w-4 mr-2" />
            Send
          </Button>
          
          <Button 
            variant="outline"
            onClick={() => handleSend('text')}
            disabled={!input.trim() || isLoading}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Forbedr dette
          </Button>
          
          <Button 
            variant="outline"
            onClick={() => handleQuickPrompt('Forklar det her som til et barn')}
            disabled={isLoading}
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Forklar simpelt
          </Button>
          
          <Button 
            variant="outline"
            onClick={() => handleSend('email')}
            disabled={!input.trim() || isLoading}
          >
            <Mail className="h-4 w-4 mr-2" />
            Forbedr og klargør til mail
          </Button>
          
          <Button 
            variant="outline"
            onClick={() => handleSend('objection')}
            disabled={!input.trim() || isLoading}
          >
            <AlertCircle className="h-4 w-4 mr-2" />
            Gennemgå som indsigelse
          </Button>
          
          <Button 
            variant="ghost"
            size="sm"
            onClick={onClearChat}
            disabled={messages.length === 0}
            className="ml-auto"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Ryd samtale
          </Button>
        </div>
        
        {/* Footer hints */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            <kbd className="px-1 bg-muted rounded">Ctrl/Cmd + Enter</kbd> for at sende
          </span>
          <span className={input.length > 4000 ? 'text-destructive' : ''}>
            {input.length} / 4000
          </span>
        </div>
      </div>
    </Card>
  );
}
