import { useState, useMemo, useEffect, useCallback } from "react";
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
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Info, X, Plus, Clock, Search, Route, Loader2, Calendar, GripVertical, AlertTriangle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScheduleTimesDialog } from "./ScheduleTimesDialog";
import { InlineTimeEditor } from "./InlineTimeEditor";
import type { Inspector } from "@/pages/PlanlaegSyn";
import type { MondayItem } from "@/lib/supabase";
import type { InspectorRoute } from "@/types/route-optimizer";

interface InspectorsPanelProps {
  inspectors: Inspector[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  assignments: Map<string, MondayItem[]>;
  existingAssignments: Map<string, MondayItem[]>;
  onRemoveAssignment: (inspectorId: string, inspectionId: number) => void;
  hasSelectedInspections: boolean;
  scheduledTimes: Map<number, { start: string; end: string }>;
  onUpdateScheduledTimes: (times: Map<number, { start: string; end: string }>) => void;
  onAutoScheduledTimes: (times: Map<number, { start: string; end: string }>, forceIds?: number[]) => void;
  getInspectorRoute?: (inspectorId: string) => InspectorRoute | undefined;
  isRouteLoading?: boolean;
  selectedDate: string;
  onClearManualOverrides?: (ids: number[]) => void;
  existingAssignmentsMap: Map<string, MondayItem[]>;
  inspectorShiftDetails: Map<string, { type: string; start_time: string; end_time: string; duration_minutes: number; address?: string; lat?: number; lng?: number }[]>;
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

const ROUTE_OPTIMIZER_URL = "https://web-production-95fdd.up.railway.app";

// ─── Sortable stop row ─────────────────────────────────────────────────────────

interface SortableStopRowProps {
  item: MondayItem;
  isExisting: boolean;
  routeStop: { sequence: number; travel_from_previous_mins: number; note?: string } | undefined;
  scheduledTime: { start: string; end: string } | undefined;
  onRemoveAssignment: (inspectorId: string, inspectionId: number) => void;
  inspectorId: string;
  onUpdateScheduledTimes: (times: Map<number, { start: string; end: string }>) => void;
  displayIndex: number;
}

function SortableStopRow({
  item,
  isExisting,
  routeStop,
  scheduledTime,
  onRemoveAssignment,
  inspectorId,
  onUpdateScheduledTimes,
  displayIndex,
}: SortableStopRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `stop-${item.id}`, disabled: isExisting });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const abbr = getTypeAbbreviation(item.synstype);

  const handleInlineTimeChange = (inspectionId: number, times: { start: string; end: string }) => {
    const newTimes = new Map<number, { start: string; end: string }>();
    newTimes.set(inspectionId, times);
    onUpdateScheduledTimes(newTimes);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 text-xs rounded px-2 py-1.5 min-w-0",
        isExisting ? "bg-muted/30" : "bg-primary/5 border border-primary/20"
      )}
    >
      {/* Drag handle for non-existing items */}
      {!isExisting && (
        <button
          {...attributes}
          {...listeners}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-muted touch-none"
          tabIndex={-1}
        >
          <GripVertical className="h-3 w-3" />
        </button>
      )}

      {/* Sequence number */}
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-medium flex items-center justify-center">
        {displayIndex + 1}
      </span>

      {/* Inline time editor */}
      {!isExisting && (
        <InlineTimeEditor
          inspection={item}
          scheduledTime={scheduledTime}
          onTimeChange={handleInlineTimeChange}
          compact
        />
      )}

      {/* For existing items, show static time */}
      {isExisting && scheduledTime && (
        <span className="flex-shrink-0 font-mono text-[10px] text-muted-foreground px-1">
          {scheduledTime.start}-{scheduledTime.end}
        </span>
      )}

      {/* Main content: Type • Address */}
      <div className="flex items-center gap-1 min-w-0 flex-1">
        <span className={cn("flex-shrink-0 font-medium", getTypeColor(abbr).split(' ')[1] || 'text-muted-foreground')}>
          {abbr}
        </span>
        <span className="text-muted-foreground/50">•</span>
        <span className={cn(
          "truncate min-w-0 max-w-[200px]",
          isExisting ? "text-muted-foreground" : "text-foreground"
        )}>
          {item.adresse || "Ukendt adresse"}
        </span>
      </div>

      {/* Note display */}
      {((item as any).note || routeStop?.note) && (
        <span className="text-[10px] text-muted-foreground italic truncate max-w-[160px]" title={(item as any).note || routeStop?.note}>
          {(item as any).note || routeStop?.note}
        </span>
      )}

      {/* Compact badges */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-muted-foreground text-[10px]">
          {item.antal_vaerelser ?? "?"}v
        </span>
        {(item as any).duration_minutes != null && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-600 border-amber-400/40 font-normal italic">
            Manuel
          </Badge>
        )}
        {routeStop && routeStop.travel_from_previous_mins > 0 && (
          <span className="text-muted-foreground/60 text-[10px]">
            +{routeStop.travel_from_previous_mins}m
          </span>
        )}
        {isExisting ? (
          <Badge variant="outline" className="text-[10px] px-1 py-0 text-muted-foreground border-muted-foreground/30">
            E
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] px-1 py-0 text-primary border-primary/30">
            N
          </Badge>
        )}
      </div>

      {/* Remove button for new items only */}
      {!isExisting && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemoveAssignment(inspectorId, item.id);
          }}
          className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors p-0.5 rounded hover:bg-destructive/10"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ─── Droppable Inspector ────────────────────────────────────────────────────────

interface DroppableInspectorProps {
  inspector: Inspector;
  isSelected: boolean;
  onSelect: (id: string) => void;
  assignedItems: MondayItem[];
  existingItemIds: Set<number>;
  onRemoveAssignment: (inspectorId: string, inspectionId: number) => void;
  hasSelectedInspections: boolean;
  scheduledTimes: Map<number, { start: string; end: string }>;
  onUpdateScheduledTimes: (times: Map<number, { start: string; end: string }>) => void;
  onAutoScheduledTimes: (times: Map<number, { start: string; end: string }>, forceIds?: number[]) => void;
  routeData?: InspectorRoute;
  isRouteLoading?: boolean;
  selectedDate: string;
  onClearManualOverrides?: (ids: number[]) => void;
  existingAssignmentsMap: Map<string, MondayItem[]>;
  inspectorShiftDetails: Map<string, { type: string; start_time: string; end_time: string; duration_minutes: number; address?: string; lat?: number; lng?: number }[]>;
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
  onAutoScheduledTimes,
  routeData,
  isRouteLoading,
  selectedDate,
  onClearManualOverrides,
  existingAssignmentsMap,
  inspectorShiftDetails,
}: DroppableInspectorProps) {
  const [timeDialogOpen, setTimeDialogOpen] = useState(false);
  const [manualOrder, setManualOrder] = useState<number[] | null>(null);
  const [isReorderLoading, setIsReorderLoading] = useState(false);
  const [fixedOrderStops, setFixedOrderStops] = useState<import("@/types/route-optimizer").RouteStop[] | null>(null);

  // Reset manual order and fixed stops whenever Railway returns fresh route data
  useEffect(() => {
    setManualOrder(null);
    setFixedOrderStops(null);
  }, [routeData]);

  const { setNodeRef, isOver } = useDroppable({
    id: `inspector-${inspector.inspector_uuid}`,
    data: { inspectorId: inspector.inspector_uuid },
  });

  const hasCustomTime = isCustomTime(inspector.start_tid, inspector.slut_tid);
  const hasScheduledTimes = assignedItems.some((item) => scheduledTimes.has(item.id));

  // Inner DnD sensors with smaller distance
  const innerSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Auto-apply route optimizer times when route data arrives
  useEffect(() => {
    if (routeData && routeData.stops.length > 0) {
      const newTimes = new Map<number, { start: string; end: string }>();
      routeData.stops.forEach((stop) => {
        if (stop.monday_item_id) {
          newTimes.set(stop.monday_item_id, {
            start: stop.start_time,
            end: stop.end_time,
          });
        }
      });
      if (newTimes.size > 0) {
        onAutoScheduledTimes(newTimes);
      }
    }
  }, [routeData, onAutoScheduledTimes]);

  // Initialize manualOrder from route data when it first arrives (only if null)
  useEffect(() => {
    if (routeData && routeData.stops.length > 0 && manualOrder === null) {
      // Don't auto-set manualOrder - leave null so Railway order is used directly
    }
  }, [routeData]);

  // Sort items: use manualOrder if set, otherwise use routeData sequence
  const sortedItems = useMemo(() => {
    if (manualOrder) {
      return [...assignedItems].sort((a, b) => {
        const idxA = manualOrder.indexOf(a.id);
        const idxB = manualOrder.indexOf(b.id);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      });
    }
    return [...assignedItems].sort((a, b) => {
      if (!routeData) return 0;
      const seqA = routeData.stops.find((s) => s.monday_item_id === a.id)?.sequence ?? 999;
      const seqB = routeData.stops.find((s) => s.monday_item_id === b.id)?.sequence ?? 999;
      return seqA - seqB;
    });
  }, [assignedItems, manualOrder, routeData]);

  const sortableIds = useMemo(
    () => sortedItems.filter((item) => !existingItemIds.has(item.id)).map((item) => `stop-${item.id}`),
    [sortedItems, existingItemIds]
  );

  // Call Railway /preview-routes for this inspector with a specific order
  const callRailwayReorder = useCallback(
    async (orderedIds: number[], fixedOrder: boolean) => {
      const inspectorId = inspector.inspector_uuid;
      const existingItems = existingAssignmentsMap.get(inspectorId) || [];
      const shiftDetails = inspectorShiftDetails.get(inspectorId) || [];

      // Build fixed_stops from shift_details (only geocoded ones)
      const fixedStops = shiftDetails
        .filter(s => s.lat && s.lng)
        .map(s => ({
          lat: s.lat!,
          lng: s.lng!,
          start_time: s.start_time?.substring(0, 5) || '',
          end_time: s.end_time?.substring(0, 5) || '',
          address: s.address || '',
          type: s.type || 'B'
        }));

      const assignment: Record<string, unknown> = {
        inspector_id: inspectorId,
        inspection_ids: orderedIds.map(String),
        existing_ids: existingItems.map((i) => String(i.id)),
      };
      if (fixedOrder) assignment.fixed_order = true;
      if (fixedStops.length > 0) assignment.fixed_stops = fixedStops;

      const payload = {
        date: selectedDate,
        assignments: [assignment],
      };

      setIsReorderLoading(true);
      try {
        const response = await fetch(`${ROUTE_OPTIMIZER_URL}/preview-routes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          console.error("❌ Reorder preview failed:", response.status);
          return;
        }

        const data = await response.json();
        if (data.status === "error") {
          console.error("❌ Reorder preview error:", data.error);
          return;
        }

        const route = data.routes?.find((r: InspectorRoute) => r.inspector_id === inspectorId);
        if (route && route.stops.length > 0) {
          // Store the fresh fixed_order stops for the Rediger modal
          setFixedOrderStops(route.stops);

          const freshTimes = new Map<number, { start: string; end: string }>();
          const itemIds: number[] = [];
          route.stops.forEach((stop: { monday_item_id?: number; start_time: string; end_time: string }) => {
            if (stop.monday_item_id) {
              freshTimes.set(stop.monday_item_id, {
                start: stop.start_time,
                end: stop.end_time,
              });
              itemIds.push(stop.monday_item_id);
            }
          });

          console.log("🚂 Railway fixed_order response freshTimes:", Object.fromEntries(freshTimes));
          console.log("🚂 Railway forceIds for autoSchedule:", itemIds);

          // Clear manual overrides first so fresh times are not blocked
          onClearManualOverrides?.(itemIds);
          // Apply fresh Railway times with forceIds to bypass stale closure
          if (freshTimes.size > 0) {
            onAutoScheduledTimes(freshTimes, itemIds);
            // Re-protect these IDs so the stale routeData auto-apply cannot overwrite them
            onUpdateScheduledTimes(freshTimes);
          }
        }
      } catch (err) {
        console.error("❌ Reorder Railway call failed:", err);
      } finally {
        setIsReorderLoading(false);
      }
    },
    [inspector.inspector_uuid, existingAssignmentsMap, inspectorShiftDetails, selectedDate, onClearManualOverrides, onAutoScheduledTimes]
  );

  const handleSortDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeId = Number(active.id.toString().replace("stop-", ""));
      const overId = Number(over.id.toString().replace("stop-", ""));

      const currentOrder = sortedItems.filter((i) => !existingItemIds.has(i.id)).map((i) => i.id);
      const oldIndex = currentOrder.indexOf(activeId);
      const newIndex = currentOrder.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
      setManualOrder(newOrder);

      // Clear overrides immediately so Railway response is not blocked
      console.log("🧹 onDragEnd clearing manualTimeOverrides for IDs:", newOrder);
      onClearManualOverrides?.(newOrder);

      // Call Railway with fixed_order: true
      callRailwayReorder(newOrder, true);
    },
    [sortedItems, existingItemIds, callRailwayReorder, onClearManualOverrides]
  );

  const handleResetOrder = useCallback(() => {
    setManualOrder(null);
    setFixedOrderStops(null);

    // Re-call Railway without fixed_order (normal TSP)
    const allItemIds = assignedItems.filter((i) => !existingItemIds.has(i.id)).map((i) => i.id);
    if (allItemIds.length > 0) {
      // Clear overrides first
      onClearManualOverrides?.(allItemIds);
      callRailwayReorder(allItemIds, false);
    }
  }, [assignedItems, existingItemIds, onClearManualOverrides, callRailwayReorder]);

  return (
    <>
      <div ref={setNodeRef} className="space-y-0 min-w-0 overflow-hidden">
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
                {inspector.notes && (
                  <span className="text-xs text-orange-500 truncate max-w-[150px]" title={inspector.notes}>
                    {inspector.notes}
                  </span>
                )}
                {(inspector.scheduled_shifts ?? 0) > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        <Calendar className="h-3 w-3" />
                        <span className="text-xs font-medium">{inspector.scheduled_shifts}</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{inspector.scheduled_shifts} bookede syn vises nedenfor</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {/* Manual reorder badge */}
                {manualOrder !== null && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                        <AlertTriangle className="h-3 w-3" />
                        <span className="text-[10px] font-medium">Manuelt</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Rækkefølge justeret manuelt</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {manualOrder !== null && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResetOrder();
                    }}
                    className="flex items-center gap-0.5 text-[10px] text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Nulstil</span>
                  </button>
                )}
                {(hasSelectedInspections || isOver) && (
                  <Plus className="h-4 w-4 text-primary flex-shrink-0" />
                )}
              </div>
              <p className={cn("text-xs mt-1 truncate", inspector.adresse ? "text-muted-foreground" : "text-amber-600")}>
                {inspector.adresse || "Ingen adresse"}
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {inspector.synstyper.length === 0 ? (
                  <span className="text-xs text-amber-600">Ingen kompetencer registreret</span>
                ) : inspector.synstyper.map((type) => (
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
              {routeData && assignedItems.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                  <Route className="h-3 w-3" />
                  <span>{routeData.total_km.toFixed(1)} km</span>
                  <span className="text-muted-foreground/60">•</span>
                  <span>{routeData.total_travel_minutes} min</span>
                </div>
              )}
              {(isRouteLoading || isReorderLoading) && assignedItems.length > 0 && (
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

        {/* Booked shifts + Assigned inspections as sub-items */}
        {(assignedItems.length > 0 || (inspector.shift_details && inspector.shift_details.length > 0)) && (
          <div className="ml-4 mt-1 space-y-1 border-l-2 border-primary/30 pl-3 pb-2 overflow-hidden min-w-0">
            {/* Booked shifts from WorkFeed */}
            {inspector.shift_details && inspector.shift_details.length > 0 && (
              inspector.shift_details.map((shift, index) => {
                const abbr = shift.type || "?";
                const startTime = shift.start_time?.substring(0, 5) || "";
                const endTime = shift.end_time?.substring(0, 5) || "";

                return (
                  <div
                    key={`booked-${index}`}
                    className="flex items-center gap-2 text-xs rounded px-2 py-1.5 min-w-0 max-w-full bg-muted/30"
                  >
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      {startTime && endTime && (
                        <>
                          <span className="flex-shrink-0 font-mono text-[10px] text-muted-foreground">
                            {startTime}-{endTime}
                          </span>
                          <span className="text-muted-foreground/50">•</span>
                        </>
                      )}
                      <span className={cn("flex-shrink-0 font-medium", getTypeColor(abbr).split(' ')[1] || 'text-muted-foreground')}>
                        {abbr}
                      </span>
                      <span className="text-muted-foreground/50">•</span>
                      <span className="truncate min-w-0 text-muted-foreground max-w-[200px]">
                        {shift.address || "Ukendt adresse"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {shift.duration_minutes && (
                        <span className="text-muted-foreground text-[10px]">
                          {shift.duration_minutes}m
                        </span>
                      )}
                      <Badge variant="outline" className="text-[10px] px-1 py-0 text-blue-600 border-blue-300 dark:text-blue-400 dark:border-blue-600">
                        B
                      </Badge>
                    </div>
                  </div>
                );
              })
            )}

            {/* Sortable assigned inspections */}
            <DndContext
              sensors={innerSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleSortDragEnd}
            >
              <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                {sortedItems.map((item, index) => {
                  const isExisting = existingItemIds.has(item.id);
                  const routeStop = routeData?.stops.find((s) => s.monday_item_id === item.id);

                  return (
                    <SortableStopRow
                      key={item.id}
                      item={item}
                      isExisting={isExisting}
                      routeStop={routeStop}
                      scheduledTime={scheduledTimes.get(item.id)}
                      onRemoveAssignment={onRemoveAssignment}
                      inspectorId={inspector.inspector_uuid}
                      onUpdateScheduledTimes={onUpdateScheduledTimes}
                      displayIndex={index}
                    />
                  );
                })}
              </SortableContext>
            </DndContext>
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
        routeData={fixedOrderStops ?? routeData?.stops}
      />
    </>
  );
}

// ─── Panel wrapper ──────────────────────────────────────────────────────────────

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
  onAutoScheduledTimes,
  getInspectorRoute,
  isRouteLoading,
  selectedDate,
  onClearManualOverrides,
  existingAssignmentsMap,
  inspectorShiftDetails,
}: InspectorsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyNoInspections, setShowOnlyNoInspections] = useState(false);

  const filteredInspectors = useMemo(() => {
    let result = inspectors;

    if (showOnlyNoInspections) {
      result = result.filter((inspector) => {
        const bookedShifts = inspector.scheduled_shifts || 0;
        const existingItems = (existingAssignments.get(inspector.inspector_uuid) || []).length;
        return bookedShifts === 0 && existingItems === 0;
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((i) => i.navn.toLowerCase().includes(query));
    }

    return result;
  }, [inspectors, searchQuery, showOnlyNoInspections, existingAssignments]);

  return (
    <Card className="flex flex-col h-full min-h-0 overflow-hidden">
      <CardHeader className="pb-3 flex-shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Tilgængelige konsulenter</CardTitle>
          <Button
            variant={showOnlyNoInspections ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setShowOnlyNoInspections(!showOnlyNoInspections)}
          >
            Ingen syn
          </Button>
        </div>
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
      <CardContent className="flex-1 min-h-0 overflow-hidden p-0">
        <ScrollArea className="h-full min-h-0 px-6 pb-6">
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
                    onAutoScheduledTimes={onAutoScheduledTimes}
                    routeData={getInspectorRoute?.(inspector.inspector_uuid)}
                    isRouteLoading={isRouteLoading}
                    selectedDate={selectedDate}
                    onClearManualOverrides={onClearManualOverrides}
                    existingAssignmentsMap={existingAssignmentsMap}
                    inspectorShiftDetails={inspectorShiftDetails}
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
