import { Button } from '@/components/ui/button';
import { FileText, List, ClipboardList } from 'lucide-react';

interface ActionsTabProps {
  onExecuteAction: (action: 'summarize' | 'extract' | 'plan') => void;
  hasMessages: boolean;
  isLoading: boolean;
}

const actions = [
  {
    key: 'summarize' as const,
    label: 'Opsummer',
    description: 'Lav en kort opsummering af samtalen',
    icon: FileText,
  },
  {
    key: 'extract' as const,
    label: 'Udtræk punkter',
    description: 'Udtræk nøglepunkter i punktform',
    icon: List,
  },
  {
    key: 'plan' as const,
    label: 'Lav handlingsplan',
    description: 'Generér en handlingsplan baseret på samtalen',
    icon: ClipboardList,
  },
];

export function ActionsTab({ onExecuteAction, hasMessages, isLoading }: ActionsTabProps) {
  return (
    <div className="space-y-3">
      {!hasMessages && (
        <p className="text-sm text-muted-foreground mb-4">
          Start en samtale for at bruge handlinger
        </p>
      )}
      
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.key}
            variant="outline"
            className="w-full justify-start h-auto py-3"
            onClick={() => onExecuteAction(action.key)}
            disabled={!hasMessages || isLoading}
          >
            <div className="flex items-start gap-3 text-left">
              <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">{action.label}</div>
                <div className="text-xs text-muted-foreground font-normal">
                  {action.description}
                </div>
              </div>
            </div>
          </Button>
        );
      })}
    </div>
  );
}
