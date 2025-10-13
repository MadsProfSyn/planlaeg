import { Brain, History, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ChatSession } from '@/lib/chatHistory';

interface HeaderWithHistoryProps {
  sessions: ChatSession[];
  onLoadSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewChat: () => void;
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 60) return `${diffMins} min siden`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)} timer siden`;
  return date.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

export function HeaderWithHistory({
  sessions,
  onLoadSession,
  onDeleteSession,
  onNewChat,
}: HeaderWithHistoryProps) {
  return (
    <header className="sticky top-0 z-10 bg-background border-b">
      <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">ProfSyn AI</h1>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <History className="h-4 w-4 mr-2" />
              Seneste samtaler
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            {sessions.length === 0 ? (
              <DropdownMenuItem disabled>
                Ingen gemte samtaler
              </DropdownMenuItem>
            ) : (
              sessions.map(session => (
                <DropdownMenuItem key={session.id} className="cursor-default">
                  <div className="flex items-center justify-between w-full gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{session.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTimestamp(session.lastUpdated)}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          onLoadSession(session.id);
                        }}
                      >
                        Åbn
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(session.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onNewChat}>
              <Plus className="h-4 w-4 mr-2" />
              Ny samtale
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
