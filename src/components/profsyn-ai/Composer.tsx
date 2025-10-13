import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Sparkles, BookOpen, Mail, AlertCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
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
    <div className="sticky bottom-0 bg-card border-t shadow-md">
      <div className="max-w-3xl mx-auto p-3 space-y-2">
        {/* Textarea */}
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Skriv din besked…"
          className="w-full resize-none border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[60px] max-h-[200px]"
          disabled={isLoading}
        />
        
        {/* Action Buttons Row */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex flex-wrap gap-2 flex-1">
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
          </div>
          
          <Button 
            variant="ghost"
            size="sm"
            onClick={onClearChat}
            disabled={messages.length === 0}
            className="text-muted-foreground"
          >
            <Trash2 className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Ryd samtale</span>
          </Button>
        </div>
        
        {/* Footer hints */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Ctrl/Cmd + Enter</kbd>
            <span>for at sende</span>
          </span>
          <span className={cn(
            input.length > 4000 && 'text-destructive font-medium'
          )}>
            {input.length} / 4000
          </span>
        </div>
      </div>
    </div>
  );
}
