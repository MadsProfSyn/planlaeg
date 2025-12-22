import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDroppable } from "@dnd-kit/core";
import { Info, X, Plus, Clock, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScheduleTimesDialog } from "./ScheduleTimesDialog";
import type { Inspector } from "@/pages/PlanlaegSyn";
import type { MondayItem } from "@/lib/supabase";

interface InspectorsPanelProps {
  inspectors: Inspector[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  assignments: Map<string, MondayItem[]>;
  onRemoveAssignment: (inspectorId: string, inspectionId: number) => void;
  hasSelectedInspections: boolean;
  scheduledTimes: Map<number, { start: string; end: string }>;
  onUpdateScheduledTimes: (times: Map<number, { start: string; end: string }>) => void;
}

const TYPE_COLORS: Record<string, string> = {
  FF: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  IF: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  PS: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  PA: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

const TYPE_MAP: Record<string, string> = {
  Fraflytningssyn: "FF",
  Indflytningssyn: "IF",
  Projektsyn: "PS",
  Proforma: "PA",
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

function getTypeAbbreviation(type: string | null): string {
  if (!type) return "?";
  return TYPE_MAP[type] || type.substring(0, 2).toUpperCase();
}

function getTypeColor(abbr: string): string {
  return TYPE_COLORS[abbr] || "bg-muted text-muted-foreground";
}

interface DroppableInspectorProps {
  inspector: Inspector;
  isSelected: boolean;
  onSelect: (id: string) => void;
  assignedItems: MondayItem[];
  onRemoveAssignment: (inspectorId: string, inspectionId: number) => void;
  hasSelectedInspections: boolean;
  scheduledTimes: Map<number, { start: string; end: string }>;
  onUpdateScheduledTimes: (times: Map<number, { start: string; end: string }>) => void;
}

function DroppableInspector({
  inspector,
  isSelected,
  onSelect,
  assignedItems,
  onRemoveAssignment,
  hasSelectedInspections,
  scheduledTimes,
  onUpdateScheduledTimes,
}: DroppableInspectorProps) {
  const [timeDialogOpen, setTimeDialogOpen] = useState(false);
  
  const { setNodeRef, isOver } = useDroppable({
    id: `inspector-${inspector.inspector_uuid}`,
    data: { inspectorId: inspector.inspector_uuid },
  });
  
  const hasCustomTime = isCustomTime(inspector.start_tid, inspector.slut_tid);
  
  // Check if any assigned items have scheduled times
  const hasScheduledTimes = assignedItems.some((item) => scheduledTimes.has(item.id));
  
  return (
    <>
      <div ref={setNodeRef} className="space-y-0">
        <div
          onClick={() => onSelect(inspector.inspector_uuid)}
          className={cn(
            "p-3 rounded-lg border cursor-pointer transition-all",
            "hover:bg-muted/50",
            isSelected && "ring-2 ring-primary bg-primary/5",
            hasSelectedInspections && "ring-1 ring-primary/30 border-primary/50",
            isOver && "ring-2 ring-primary border-dashed bg-primary/10"
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
                {(hasSelectedInspections || isOver) && (
                  <Plus className="h-4 w-4 text-primary flex-shrink-0" />
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
            <div className="flex-shrink-0">
              {assignedItems.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTimeDialogOpen(true);
                  }}
                >
                  <Clock className="h-3 w-3" />
                  {hasScheduledTimes ? "Rediger" : "Vælg tidspunkt"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Assigned inspections as sub-items */}
        {assignedItems.length > 0 && (
          <div className="ml-4 mt-1 space-y-1 border-l-2 border-primary/30 pl-3 pb-2">
            {assignedItems.map((item) => {
              const abbr = getTypeAbbreviation(item.synstype);
              const scheduledTime = scheduledTimes.get(item.id);
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1.5"
                >
                  <span className="flex-1 truncate text-foreground">
                    {item.adresse || "Ukendt adresse"}
                  </span>
                  <Badge className={cn("text-[10px] px-1.5 py-0", getTypeColor(abbr))}>
                    {abbr}
                  </Badge>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {item.antal_vaerelser ?? "?"} vær.
                  </span>
                  {scheduledTime && (
                    <span className="text-muted-foreground font-mono text-[10px] whitespace-nowrap">
                      {scheduledTime.start}-{scheduledTime.end}
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveAssignment(inspector.inspector_uuid, item.id);
                    }}
                    className="text-muted-foreground hover:text-destructive transition-colors p-0.5 rounded hover:bg-destructive/10"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ScheduleTimesDialog
        open={timeDialogOpen}
        onOpenChange={setTimeDialogOpen}
        inspectorName={inspector.navn}
        inspections={assignedItems}
        existingTimes={scheduledTimes}
        onSave={onUpdateScheduledTimes}
      />
    </>
  );
}

export function InspectorsPanel({
  inspectors,
  isLoading,
  selectedId,
  onSelect,
  assignments,
  onRemoveAssignment,
  hasSelectedInspections,
  scheduledTimes,
  onUpdateScheduledTimes,
}: InspectorsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredInspectors = useMemo(() => {
    if (!searchQuery.trim()) return inspectors;
    const query = searchQuery.toLowerCase();
    return inspectors.filter((inspector) =>
      inspector.navn.toLowerCase().includes(query)
    );
  }, [inspectors, searchQuery]);

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <CardHeader className="pb-3 flex-shrink-0 space-y-3">
        <CardTitle className="text-lg">Tilgængelige konsulenter</CardTitle>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søg efter konsulent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-6 pb-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : filteredInspectors.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              {searchQuery ? "Ingen konsulenter matcher søgningen" : "Ingen tilgængelige konsulenter for denne dato"}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredInspectors.map((inspector) => (
                <DroppableInspector
                  key={inspector.availability_id}
                  inspector={inspector}
                  isSelected={selectedId === inspector.inspector_uuid}
                  onSelect={onSelect}
                  assignedItems={assignments.get(inspector.inspector_uuid) || []}
                  onRemoveAssignment={onRemoveAssignment}
                  hasSelectedInspections={hasSelectedInspections}
                  scheduledTimes={scheduledTimes}
                  onUpdateScheduledTimes={onUpdateScheduledTimes}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
