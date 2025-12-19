import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Inspector } from "@/pages/PlanlaegSyn";

interface InspectorsPanelProps {
  inspectors: Inspector[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  FF: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  IF: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  PS: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  PA: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

const DEFAULT_START = "08:30";
const DEFAULT_END = "16:00";

function isCustomTime(start: string | null, end: string | null): boolean {
  const startTime = start?.substring(0, 5) || DEFAULT_START;
  const endTime = end?.substring(0, 5) || DEFAULT_END;
  return startTime !== DEFAULT_START || endTime !== DEFAULT_END;
}

function formatTimeRange(start: string | null, end: string | null): string {
  const startTime = start?.substring(0, 5) || DEFAULT_START;
  const endTime = end?.substring(0, 5) || DEFAULT_END;
  return `${startTime} - ${endTime}`;
}

export function InspectorsPanel({
  inspectors,
  isLoading,
  selectedId,
  onSelect,
}: InspectorsPanelProps) {
  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="text-lg">Tilgængelige konsulenter</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-6 pb-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : inspectors.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              Ingen tilgængelige konsulenter for denne dato
            </div>
          ) : (
            <div className="space-y-2">
              {inspectors.map((inspector) => {
                const isSelected = selectedId === inspector.inspector_uuid;
                const hasCustomTime = isCustomTime(inspector.start_tid, inspector.slut_tid);
                
                return (
                  <div
                    key={inspector.availability_id}
                    onClick={() => onSelect(inspector.inspector_uuid)}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-all",
                      "hover:bg-muted/50",
                      isSelected && "ring-2 ring-primary bg-primary/5"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">
                            {inspector.navn}
                          </p>
                          {hasCustomTime && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-orange-500 flex-shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Kun tilgængelig {formatTimeRange(inspector.start_tid, inspector.slut_tid)}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {inspector.adresse || "Ingen adresse"}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {inspector.synstyper.map((type) => (
                            <Badge
                              key={type}
                              className={cn(
                                "text-xs",
                                TYPE_COLORS[type] || "bg-muted text-muted-foreground"
                              )}
                            >
                              {type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground text-right flex-shrink-0">
                        <span className="font-medium">KM:</span> -
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
