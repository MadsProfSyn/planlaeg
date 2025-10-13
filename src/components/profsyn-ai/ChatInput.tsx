import { useState, KeyboardEvent, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (content: string) => void;
  isLoading: boolean;
  streaming: boolean;
  onStreamingChange: (streaming: boolean) => void;
}

const MAX_CHARS = 4000;

export function ChatInput({ onSend, isLoading, streaming, onStreamingChange }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (input.trim() && !isLoading && input.length <= MAX_CHARS) {
      onSend(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const charCount = input.length;
  const isOverLimit = charCount > MAX_CHARS;

  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch
              id="streaming"
              checked={streaming}
              onCheckedChange={onStreamingChange}
              disabled={isLoading}
            />
            <Label htmlFor="streaming" className="cursor-pointer">
              Streaming svar
            </Label>
          </div>
          <span className={`text-xs ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
            {charCount} / {MAX_CHARS}
          </span>
        </div>

        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Stil et spørgsmål... (Ctrl/Cmd + Enter for at sende)"
            className="min-h-[80px] max-h-[200px] resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || isOverLimit}
            size="icon"
            className="h-[80px] w-[80px] flex-shrink-0"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Tryk <kbd className="px-1 bg-muted rounded">Shift + Enter</kbd> for ny linje
        </p>
      </div>
    </Card>
  );
}
