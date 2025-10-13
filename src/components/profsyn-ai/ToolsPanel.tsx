import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTab } from './DataTab';
import { ActionsTab } from './ActionsTab';
import { MessageSquare, Database, Zap } from 'lucide-react';

interface CSVData {
  headers: string[];
  rows: any[][];
  rowCount: number;
}

interface ToolsPanelProps {
  csvData: CSVData | null;
  onUploadCSV: (file: File) => void;
  onClearCSV: () => void;
  onExecuteAction: (action: 'summarize' | 'extract' | 'plan') => void;
  hasMessages: boolean;
  isLoading: boolean;
}

export function ToolsPanel({
  csvData,
  onUploadCSV,
  onClearCSV,
  onExecuteAction,
  hasMessages,
  isLoading,
}: ToolsPanelProps) {
  return (
    <Card className="p-4">
      <Tabs defaultValue="text" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="text" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Tekst
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-2">
            <Database className="h-4 w-4" />
            Data
          </TabsTrigger>
          <TabsTrigger value="actions" className="gap-2">
            <Zap className="h-4 w-4" />
            Handlinger
          </TabsTrigger>
        </TabsList>

        <TabsContent value="text" className="mt-4">
          <div className="text-sm text-muted-foreground">
            <p>Standard chat-tilstand. Stil spørgsmål og få svar fra AI'en.</p>
          </div>
        </TabsContent>

        <TabsContent value="data" className="mt-4">
          <DataTab
            csvData={csvData}
            onUploadCSV={onUploadCSV}
            onClearCSV={onClearCSV}
          />
        </TabsContent>

        <TabsContent value="actions" className="mt-4">
          <ActionsTab
            onExecuteAction={onExecuteAction}
            hasMessages={hasMessages}
            isLoading={isLoading}
          />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
