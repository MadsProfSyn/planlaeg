import { Button } from '@/components/ui/button';
import { Sparkles, Lightbulb, ListChecks, BookOpen } from 'lucide-react';

interface QuickPromptsProps {
  onSelectPrompt: (prompt: string) => void;
}

const prompts = [
  { text: 'Forbedr dette', icon: Sparkles },
  { text: 'Forklar som til et barn', icon: BookOpen },
  { text: 'Lav handlingsplan', icon: ListChecks },
  { text: 'Opsummer dette', icon: Lightbulb },
];

export function QuickPrompts({ onSelectPrompt }: QuickPromptsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {prompts.map((prompt) => {
        const Icon = prompt.icon;
        return (
          <Button
            key={prompt.text}
            variant="outline"
            size="sm"
            onClick={() => onSelectPrompt(prompt.text)}
            className="gap-2"
          >
            <Icon className="h-4 w-4" />
            {prompt.text}
          </Button>
        );
      })}
    </div>
  );
}
