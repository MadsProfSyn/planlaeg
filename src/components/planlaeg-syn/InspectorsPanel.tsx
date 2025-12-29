import { useState, useMemo, useEffect } from "react";
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
import { Info, X, Plus, Clock, Search, Route, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScheduleTimesDialog } from "./ScheduleTimesDialog";
import type { Inspector } from "@/pages/PlanlaegSyn";
import type { MondayItem } from "@/lib/supabase";
import type { InspectorRoute } from "@/types/route-optimizer";

interface InspectorsPanelProps {
  inspectors: Inspector[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  assignments: Map<string, MondayItem[]>; // Combined assignments (existing + new)
  existingAssignments: Map<string, MondayItem[]>; // Only existing (already scheduled) assignments
  onRemoveAssignment: (inspectorId: string, inspectionId: number) => void;
  hasSelectedInspections: boolean;
  scheduledTimes: Map<number, { start: string; end: string }>;
  onUpdateScheduledTimes: (times: Map<number, { start: string; end: string }>) => void;
  getInspectorRoute?: (inspectorId: string) => InspectorRoute | undefined;
  isRouteLoading?: boolean;
  selectedDate: string;
}

const TYPE_COLORS: Record<string, string> = {
  FF: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  IF: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  PS: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  PA: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  TMS: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  AS: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
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
  existingItemIds: Set<number>; // IDs of already-scheduled items (cannot be removed)
  onRemoveAssignment: (inspectorId: string, inspectionId: number) => void;
  hasSelectedInspections: boolean;
  scheduledTimes: Map<number, { start: string; end: string }>;
  onUpdateScheduledTimes: (times: Map<number, { start: string; end: string }>) => void;
  routeData?: InspectorRoute;
  isRouteLoading?: boolean;
  selectedDate: string;
}

function DroppableInspector({
  inspector,
  isSelected,
  onSelect,
  assignedItems,
  existingItemIds,
  onRemoveAssignment,
  hasSelectedInspections,
  scheduledTimes,
  onUpdateScheduledTimes,
  routeData,
  isRouteLoading,
  selectedDate,
}: DroppableInspectorProps) {
  const [timeDialogOpen, setTimeDialogOpen] = useState(false);
  
  const { setNodeRef, isOver } = useDroppable({
    id: `inspector-${inspector.inspector_uuid}`,
    data: { inspectorId: inspector.inspector_uuid },
  });
  
  const hasCustomTime = isCustomTime(inspector.start_tid, inspector.slut_tid);
  
  // Check if any assigned items have scheduled times
  const hasScheduledTimes = assignedItems.some((item) => scheduledTimes.has(item.id));

  // Auto-apply route optimizer times when route data arrives
  useEffect(() => {
    if (routeData && routeData.stops.length > 0) {
      const newTimes = new Map<number, { start: string; end: string }>();
      routeData.stops.forEach((stop) => {
        // Use monday_item_id directly (it's already a number from the API)
        if (stop.monday_item_id) {
          newTimes.set(stop.monday_item_id, {
            start: stop.start_time,
            end: stop.end_time,
          });
        }
      });
      if (newTimes.size > 0) {
        onUpdateScheduledTimes(newTimes);
      }
    }
  }, [routeData, onUpdateScheduledTimes]);
  
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
            <div className="flex-shrink-0 flex items-center gap-2">
              {/* Route summary when available */}
              {routeData && assignedItems.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                  <Route className="h-3 w-3" />
                  <span>{routeData.total_km.toFixed(1)} km</span>
                  <span className="text-muted-foreground/60">•</span>
                  <span>{routeData.total_travel_minutes} min</span>
                </div>
              )}
              {/* Loading indicator */}
              {isRouteLoading && assignedItems.length > 0 && !routeData && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
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

        {/* Timeline: Booked shifts + Assigned inspections merged chronologically */}
        {((inspector.shift_details?.length ?? 0) > 0 || assignedItems.length > 0) && (
          <div className="ml-4 mt-1 space-y-1 border-l-2 border-muted-foreground/30 pl-3 pb-2">
            {(() => {
              // Convert booked shifts to timeline items
              const bookedItems = (inspector.shift_details || []).map((shift, idx) => ({
                id: `booked-${idx}`,
                type: 'booked' as const,
                address: shift.address || "Ukendt adresse",
                synstype: shift.type,
                start_time: shift.start_time,
                end_time: shift.end_time,
                duration_minutes: shift.duration_minutes,
              }));

              // Convert assigned items to timeline format
              const assignmentItems = assignedItems.map((item) => {
                const scheduledTime = scheduledTimes.get(item.id);
                const routeStop = routeData?.stops.find((s) => s.monday_item_id === item.id);
                const isExisting = existingItemIds.has(item.id);
                return {
                  id: `assignment-${item.id}`,
                  itemId: item.id,
                  type: isExisting ? 'existing' as const : 'new' as const,
                  address: item.adresse || "Ukendt adresse",
                  synstype: item.synstype,
                  start_time: scheduledTime?.start,
                  end_time: scheduledTime?.end,
                  rooms: item.antal_vaerelser,
                  routeStop,
                  isExisting,
                };
              });

              // Merge and sort by start time (booked first if no time, then by time)
              const allItems = [...bookedItems, ...assignmentItems].sort((a, b) => {
                const timeA = a.start_time || '99:99';
                const timeB = b.start_time || '99:99';
                return timeA.localeCompare(timeB);
              });

              let sequenceNum = 1;

              return allItems.map((item) => {
                const abbr = getTypeAbbreviation(item.synstype);
                
                if (item.type === 'booked') {
                  // Booked shift row
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-1.5 text-xs rounded px-2 py-1 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50"
                    >
                      <span className="flex-shrink-0 w-4 h-4 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-[10px] font-medium flex items-center justify-center">
                        {sequenceNum++}
                      </span>
                      <Badge className={cn("text-[10px] px-1.5 py-0 flex-shrink-0", getTypeColor(abbr))}>
                        {abbr}
                      </Badge>
                      {item.start_time && item.end_time && (
                        <span className="text-green-700 dark:text-green-400 font-mono text-[10px] whitespace-nowrap flex-shrink-0">
                          {item.start_time.substring(0, 5)}-{item.end_time.substring(0, 5)}
                        </span>
                      )}
                      <span className="flex-1 min-w-0 truncate text-green-800 dark:text-green-300">
                        {item.address}
                      </span>
                    </div>
                  );
                }

                // Assignment row (existing or new)
                const assignmentItem = item as typeof assignmentItems[0];
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-2 text-xs rounded px-2 py-1.5",
                      assignmentItem.isExisting ? "bg-muted/30" : "bg-primary/5 border border-primary/20"
                    )}
                  >
                    {/* Sequence number */}
                    <span className={cn(
                      "flex-shrink-0 w-5 h-5 rounded-full text-[10px] font-medium flex items-center justify-center",
                      assignmentItem.isExisting 
                        ? "bg-muted text-muted-foreground" 
                        : "bg-primary/10 text-primary"
                    )}>
                      {sequenceNum++}
                    </span>
                    <span className={cn(
                      "flex-1 truncate",
                      assignmentItem.isExisting ? "text-muted-foreground" : "text-foreground"
                    )}>
                      {item.address}
                    </span>
                    <Badge className={cn("text-[10px] px-1.5 py-0", getTypeColor(abbr))}>
                      {abbr}
                    </Badge>
                    <span className="text-muted-foreground whitespace-nowrap">
                      {assignmentItem.rooms ?? "?"} vær.
                    </span>
                    {item.start_time && item.end_time && (
                      <span className="text-muted-foreground font-mono text-[10px] whitespace-nowrap">
                        {item.start_time}-{item.end_time}
                      </span>
                    )}
                    {/* Travel time from previous */}
                    {assignmentItem.routeStop && assignmentItem.routeStop.travel_from_previous_mins > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-muted-foreground/70 text-[10px] whitespace-nowrap">
                            +{assignmentItem.routeStop.travel_from_previous_mins}m
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Køretid fra forrige: {assignmentItem.routeStop.travel_from_previous_mins} min</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {/* Badge for existing vs new */}
                    {assignmentItem.isExisting ? (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 text-muted-foreground border-muted-foreground/30">
                        Eksist.
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 text-primary border-primary/30">
                        Ny
                      </Badge>
                    )}
                    {/* Only show remove button for new items */}
                    {!assignmentItem.isExisting && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveAssignment(inspector.inspector_uuid, assignmentItem.itemId);
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors p-0.5 rounded hover:bg-destructive/10"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              });
            })()}
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
  existingAssignments,
  onRemoveAssignment,
  hasSelectedInspections,
  scheduledTimes,
  onUpdateScheduledTimes,
  getInspectorRoute,
  isRouteLoading,
  selectedDate,
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
              {filteredInspectors.map((inspector) => {
                // Build set of existing item IDs for this inspector
                const existingItemIds = new Set(
                  (existingAssignments.get(inspector.inspector_uuid) || []).map((i) => i.id)
                );
                
                return (
                  <DroppableInspector
                    key={inspector.availability_id}
                    inspector={inspector}
                    isSelected={selectedId === inspector.inspector_uuid}
                    onSelect={onSelect}
                    assignedItems={assignments.get(inspector.inspector_uuid) || []}
                    existingItemIds={existingItemIds}
                    onRemoveAssignment={onRemoveAssignment}
                    hasSelectedInspections={hasSelectedInspections}
                    scheduledTimes={scheduledTimes}
                    onUpdateScheduledTimes={onUpdateScheduledTimes}
                    routeData={getInspectorRoute?.(inspector.inspector_uuid)}
                    isRouteLoading={isRouteLoading}
                    selectedDate={selectedDate}
                  />
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
