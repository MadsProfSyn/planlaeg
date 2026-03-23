import { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Route, UtensilsCrossed, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateInspectionDuration } from "@/lib/inspection-duration";
import type { MondayItem } from "@/lib/supabase";
import type { RouteStop } from "@/types/route-optimizer";

interface ScheduleTimesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspectorName: string;
  inspections: MondayItem[];
  existingTimes: Map<number, { start: string; end: string }>;
  onSave: (times: Map<number, { start: string; end: string }>) => void;
  routeData?: RouteStop[];
}

interface LunchBreak {
  id: string;
  afterInspectionId: number;
  startTime: string;
  durationMinutes: number;
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

function getTypeAbbreviation(type: string | null): string {
  if (!type) return "?";
  return TYPE_MAP[type] || type.substring(0, 2).toUpperCase();
}

function getTypeColor(abbr: string): string {
  return TYPE_COLORS[abbr] || "bg-muted text-muted-foreground";
}

// Time utility functions
function timeToMinutes(time: string): number {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function roundToNearest5(minutes: number): number {
  return Math.ceil(minutes / 5) * 5;
}

interface InspectionTimeData {
  inspection: MondayItem;
  sequence: number;
  durationMinutes: number;
  travelFromPreviousMins: number;
}

export function ScheduleTimesDialog({
  open,
  onOpenChange,
  inspectorName,
  inspections,
  existingTimes,
  onSave,
  routeData,
}: ScheduleTimesDialogProps) {
  // Local state for editing times
  const [localTimes, setLocalTimes] = useState<Map<number, { start: string; end: string }>>(new Map());
  const [cascadeEnabled, setCascadeEnabled] = useState(true);
  const [lunchBreaks, setLunchBreaks] = useState<LunchBreak[]>([]);
  const didInitRef = useRef(false);

  // Merge inspection data with route data to get duration and travel times
  const inspectionTimeData = useMemo<InspectionTimeData[]>(() => {
    return inspections
      .map((inspection) => {
        const routeStop = routeData?.find((s) => s.monday_item_id === inspection.id);
        const duration = getEffectiveDuration(inspection);

        return {
          inspection,
          sequence: routeStop?.sequence ?? 999,
          durationMinutes: duration,
          travelFromPreviousMins: routeStop?.travel_from_previous_mins ?? 5,
        };
      })
      .sort((a, b) => a.sequence - b.sequence);
  }, [inspections, routeData]);

  // Initialize local times ONLY when dialog opens - not when existingTimes changes
  useEffect(() => {
    if (open && !didInitRef.current) {
      const initialTimes = new Map<number, { start: string; end: string }>();
      let nextStartTime = "08:00";

      // Use sorted data for initialization
      inspectionTimeData.forEach((data) => {
        const existing = existingTimes.get(data.inspection.id);
        if (existing) {
          initialTimes.set(data.inspection.id, { start: existing.start, end: existing.end });
          nextStartTime = existing.end;
        } else {
          const startMinutes = timeToMinutes(nextStartTime);
          const endMinutes = startMinutes + data.durationMinutes;
          initialTimes.set(data.inspection.id, {
            start: nextStartTime,
            end: minutesToTime(endMinutes),
          });
          nextStartTime = minutesToTime(endMinutes);
        }
      });

      setLocalTimes(initialTimes);
      didInitRef.current = true;
    }

    // Reset init flag and lunch breaks when dialog closes
    if (!open) {
      didInitRef.current = false;
      setLunchBreaks([]);
    }
  }, [open, inspectionTimeData, existingTimes]);

  // Recalculate times accounting for lunch breaks
  const recalculateTimesWithLunch = (currentLunchBreaks: LunchBreak[]) => {
    setLocalTimes((prev) => {
      const next = new Map(prev);

      if (inspectionTimeData.length === 0) return prev;

      // Keep first inspection's time unchanged
      const firstInspection = inspectionTimeData[0];
      const firstTimes = prev.get(firstInspection.inspection.id);
      let currentEndMinutes = timeToMinutes(firstTimes?.end || "09:00");

      // Recalculate from second inspection onwards
      for (let i = 1; i < inspectionTimeData.length; i++) {
        const data = inspectionTimeData[i];
        const prevData = inspectionTimeData[i - 1];

        // Check if there's a lunch break after previous inspection
        const lunchAfterPrev = currentLunchBreaks.find(
          (l) => l.afterInspectionId === prevData.inspection.id
        );

        let newStartMinutes: number;

        if (lunchAfterPrev) {
          // Start after lunch ends + travel time
          const lunchEnd = timeToMinutes(lunchAfterPrev.startTime) + lunchAfterPrev.durationMinutes;
          newStartMinutes = roundToNearest5(lunchEnd + data.travelFromPreviousMins);
        } else {
          // Normal: previous end + travel time
          const prevEnd = timeToMinutes(next.get(prevData.inspection.id)?.end || "09:00");
          newStartMinutes = roundToNearest5(prevEnd + data.travelFromPreviousMins);
        }

        const newEndMinutes = newStartMinutes + data.durationMinutes;

        next.set(data.inspection.id, {
          start: minutesToTime(newStartMinutes),
          end: minutesToTime(newEndMinutes),
        });

        currentEndMinutes = newEndMinutes;
      }

      return next;
    });
  };

  const handleAddLunchBreak = (afterInspectionId: number) => {
    const inspectionIndex = inspectionTimeData.findIndex(
      (d) => d.inspection.id === afterInspectionId
    );
    if (inspectionIndex === -1) return;

    // Get end time of that inspection
    const currentTimes = localTimes.get(afterInspectionId);
    const endTime = currentTimes?.end || "12:00";

    const newLunch: LunchBreak = {
      id: `lunch-${Date.now()}`,
      afterInspectionId,
      startTime: endTime,
      durationMinutes: 30,
    };

    const newLunchBreaks = [
      ...lunchBreaks.filter((l) => l.afterInspectionId !== afterInspectionId),
      newLunch,
    ];

    setLunchBreaks(newLunchBreaks);
    recalculateTimesWithLunch(newLunchBreaks);
  };

  const handleLunchStartChange = (lunchId: string, newStartTime: string) => {
    const newLunchBreaks = lunchBreaks.map((l) =>
      l.id === lunchId ? { ...l, startTime: newStartTime } : l
    );
    setLunchBreaks(newLunchBreaks);
    recalculateTimesWithLunch(newLunchBreaks);
  };

  const handleLunchDurationChange = (lunchId: string, newDuration: number) => {
    const newLunchBreaks = lunchBreaks.map((l) =>
      l.id === lunchId ? { ...l, durationMinutes: newDuration } : l
    );
    setLunchBreaks(newLunchBreaks);
    recalculateTimesWithLunch(newLunchBreaks);
  };

  const handleRemoveLunchBreak = (lunchId: string) => {
    const newLunchBreaks = lunchBreaks.filter((l) => l.id !== lunchId);
    setLunchBreaks(newLunchBreaks);
    recalculateTimesWithLunch(newLunchBreaks);
  };

  const handleStartTimeChange = (inspectionId: number, newStartTime: string) => {
    setLocalTimes((prev) => {
      const next = new Map(prev);

      // Find the edited inspection's data
      const editedIndex = inspectionTimeData.findIndex(
        (d) => d.inspection.id === inspectionId
      );
      if (editedIndex === -1) return prev;

      const editedData = inspectionTimeData[editedIndex];

      // Calculate end time for edited inspection
      const startMinutes = timeToMinutes(newStartTime);
      const endMinutes = startMinutes + editedData.durationMinutes;
      next.set(inspectionId, {
        start: newStartTime,
        end: minutesToTime(endMinutes),
      });

      // Cascade to all subsequent inspections if enabled
      if (cascadeEnabled) {
        let currentEndMinutes = endMinutes;

        for (let i = editedIndex + 1; i < inspectionTimeData.length; i++) {
          const data = inspectionTimeData[i];
          const prevData = inspectionTimeData[i - 1];

          // Check for lunch break after previous inspection
          const lunchAfterPrev = lunchBreaks.find(
            (l) => l.afterInspectionId === prevData.inspection.id
          );

          let newStart: number;
          if (lunchAfterPrev) {
            const lunchEnd = timeToMinutes(lunchAfterPrev.startTime) + lunchAfterPrev.durationMinutes;
            newStart = roundToNearest5(lunchEnd + data.travelFromPreviousMins);
          } else {
            newStart = roundToNearest5(currentEndMinutes + data.travelFromPreviousMins);
          }

          const newEnd = newStart + data.durationMinutes;
          next.set(data.inspection.id, {
            start: minutesToTime(newStart),
            end: minutesToTime(newEnd),
          });

          currentEndMinutes = newEnd;
        }
      }

      return next;
    });
  };

  const handleEndTimeChange = (inspectionId: number, newEndTime: string) => {
    setLocalTimes((prev) => {
      const next = new Map(prev);
      const existing = prev.get(inspectionId);
      if (existing) {
        next.set(inspectionId, { ...existing, end: newEndTime });
      }

      if (cascadeEnabled) {
        const editedIndex = inspectionTimeData.findIndex(
          (d) => d.inspection.id === inspectionId
        );
        if (editedIndex === -1) return next;

        let currentEndMinutes = timeToMinutes(newEndTime);

        for (let i = editedIndex + 1; i < inspectionTimeData.length; i++) {
          const data = inspectionTimeData[i];
          const prevData = inspectionTimeData[i - 1];

          const lunchAfterPrev = lunchBreaks.find(
            (l) => l.afterInspectionId === prevData.inspection.id
          );

          let newStart: number;
          if (lunchAfterPrev) {
            const lunchEnd = timeToMinutes(lunchAfterPrev.startTime) + lunchAfterPrev.durationMinutes;
            newStart = roundToNearest5(lunchEnd + data.travelFromPreviousMins);
          } else {
            newStart = roundToNearest5(currentEndMinutes + data.travelFromPreviousMins);
          }

          const newEnd = newStart + data.durationMinutes;
          next.set(data.inspection.id, {
            start: minutesToTime(newStart),
            end: minutesToTime(newEnd),
          });
          currentEndMinutes = newEnd;
        }
      }

      return next;
    });
  };

  const handleSave = () => {
    // Only save inspection times, not lunch breaks
    onSave(localTimes);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl max-h-[85vh] flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Planlæg tidspunkter for {inspectorName}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-1">
            {inspectionTimeData.map((data, index) => {
              const abbr = getTypeAbbreviation(data.inspection.synstype);
              const times = localTimes.get(data.inspection.id) || { start: "08:00", end: "09:00" };
              const isLast = index === inspectionTimeData.length - 1;
              const lunchBreak = lunchBreaks.find((l) => l.afterInspectionId === data.inspection.id);

              return (
                <div key={data.inspection.id}>
                  {/* Travel time indicator between inspections */}
                  {index > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-1.5 pl-4">
                      <Route className="h-3 w-3" />
                      <span>+{data.travelFromPreviousMins} min kørsel</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    {/* Left side: sequence + address + meta */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Sequence number */}
                      {data.sequence < 999 && (
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center">
                          {data.sequence}
                        </span>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate max-w-[300px]">
                          {data.inspection.adresse || "Ukendt adresse"}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={cn("text-[10px] px-1.5 py-0", getTypeColor(abbr))}>
                            {abbr}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {data.inspection.antal_vaerelser ?? "?"} vær.
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({data.durationMinutes} min)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right side: time inputs */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex flex-col items-center">
                        <label
                          htmlFor={`start-${data.inspection.id}`}
                          className="text-[10px] text-muted-foreground mb-0.5"
                        >
                          Start
                        </label>
                        <input
                          id={`start-${data.inspection.id}`}
                          type="time"
                          value={times.start}
                          onChange={(e) => handleStartTimeChange(data.inspection.id, e.target.value)}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          className="w-24 h-9 px-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        />
                      </div>
                      <span className="text-muted-foreground mt-4">→</span>
                      <div className="flex flex-col items-center">
                        <label
                          htmlFor={`end-${data.inspection.id}`}
                          className="text-[10px] text-muted-foreground mb-0.5"
                        >
                          Slut
                        </label>
                        <input
                          id={`end-${data.inspection.id}`}
                          type="time"
                          value={times.end}
                          onChange={(e) => handleEndTimeChange(data.inspection.id, e.target.value)}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          className="w-24 h-9 px-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Lunch break section - after each inspection except last */}
                  {!isLast && (
                    <>
                      {lunchBreak ? (
                        <div className="flex items-center gap-3 py-2 px-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md my-2 mx-1">
                          <UtensilsCrossed className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                          <span className="font-medium text-amber-800 dark:text-amber-300 text-sm">
                            Frokostpause
                          </span>

                          <input
                            type="time"
                            value={lunchBreak.startTime}
                            onChange={(e) => handleLunchStartChange(lunchBreak.id, e.target.value)}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            className="w-24 h-8 px-2 text-sm rounded-md border border-input bg-background"
                          />

                          <span className="text-sm text-muted-foreground">-</span>

                          <span className="text-sm text-muted-foreground w-14">
                            {minutesToTime(timeToMinutes(lunchBreak.startTime) + lunchBreak.durationMinutes)}
                          </span>

                          <Select
                            value={String(lunchBreak.durationMinutes)}
                            onValueChange={(v) => handleLunchDurationChange(lunchBreak.id, Number(v))}
                          >
                            <SelectTrigger className="w-20 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="15">15 min</SelectItem>
                              <SelectItem value="30">30 min</SelectItem>
                              <SelectItem value="45">45 min</SelectItem>
                              <SelectItem value="60">60 min</SelectItem>
                            </SelectContent>
                          </Select>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 ml-auto"
                            onClick={() => handleRemoveLunchBreak(lunchBreak.id)}
                          >
                            <X className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-center my-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
                            onClick={() => handleAddLunchBreak(data.inspection.id)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Tilføj frokostpause
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4 flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-2 mr-auto">
            <Switch
              checked={cascadeEnabled}
              onCheckedChange={setCascadeEnabled}
              id="cascade-toggle"
            />
            <Label htmlFor="cascade-toggle" className="text-sm text-muted-foreground">
              Opdater efterfølgende tider automatisk
            </Label>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuller
            </Button>
            <Button onClick={handleSave}>Gem tidspunkter</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}