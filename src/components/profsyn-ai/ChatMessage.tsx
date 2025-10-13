import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check, Mail, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatMessageProps {
  message: Message;
}

type ResponseType = 'email' | 'objection' | 'normal';

function detectResponseType(content: string): ResponseType {
  if (content.includes('Emne:') && content.includes('Mail:')) return 'email';
  if (content.includes('Titel:') && content.includes('Baggrund:') && content.includes('Problem:')) return 'objection';
  return 'normal';
}

function parseEmailResponse(content: string): { subject: string; body: string; signature: string } {
  const lines = content.split('\n');
  let subject = '';
  let body = '';
  let signature = '';
  let section: 'subject' | 'body' | 'signature' = 'subject';

  for (const line of lines) {
    if (line.startsWith('Emne:')) {
      subject = line.replace('Emne:', '').trim();
    } else if (line.startsWith('Mail:')) {
      section = 'body';
    } else if (line.startsWith('Underskrift:')) {
      section = 'signature';
      signature = line.replace('Underskrift:', '').trim();
    } else if (section === 'body' && line.trim()) {
      body += line + '\n';
    }
  }

  return { subject, body: body.trim(), signature };
}

export function ChatMessage({ message }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const responseType = !isUser ? detectResponseType(message.content) : 'normal';

  const copyToClipboard = async (text: string, successMessage: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: 'Kopieret', description: successMessage });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyNormal = () => {
    copyToClipboard(message.content, 'Tekst kopieret til udklipsholder');
  };

  const handleCopyEmail = () => {
    const parts = parseEmailResponse(message.content);
    const formatted = `${parts.subject}\n\n${parts.body}\n\n${parts.signature}`;
    copyToClipboard(formatted, 'Email kopieret til udklipsholder');
  };

  const handleCopyObjection = () => {
    copyToClipboard(message.content, 'Indsigelse kopieret til udklipsholder');
  };

  return (
    <div className={cn('flex gap-3 group', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-4 py-3 relative',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        )}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
        
        {!isUser && (
          <div className="absolute -right-12 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {responseType === 'email' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleCopyEmail}
                title="Kopiér som mail"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
              </Button>
            )}
            
            {responseType === 'objection' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleCopyObjection}
                title="Kopiér som indsigelse"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
              </Button>
            )}
            
            {responseType === 'normal' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleCopyNormal}
                title="Kopiér"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
