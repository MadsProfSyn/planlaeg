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
import { Route } from "lucide-react";
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
  const didInitRef = useRef(false);

  // Merge inspection data with route data to get duration and travel times
  const inspectionTimeData = useMemo<InspectionTimeData[]>(() => {
    return inspections
      .map((inspection) => {
        const routeStop = routeData?.find((s) => s.monday_item_id === inspection.id);
        const duration = calculateInspectionDuration({
          synstype: inspection.synstype,
          antalVaerelser: inspection.antal_vaerelser,
          raw: inspection.raw,
        });

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

    // Reset init flag when dialog closes
    if (!open) {
      didInitRef.current = false;
    }
  }, [open, inspectionTimeData, existingTimes]);

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

          // New start = previous end + travel time (rounded to 5 min)
          const newStart = roundToNearest5(currentEndMinutes + data.travelFromPreviousMins);
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
      return next;
    });
    // No cascade when editing end time - user is manually overriding
  };

  const handleSave = () => {
    onSave(localTimes);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[80vh] flex flex-col"
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

              return (
                <div key={data.inspection.id}>
                  {/* Travel time indicator between inspections */}
                  {index > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-1.5 pl-4">
                      <Route className="h-3 w-3" />
                      <span>+{data.travelFromPreviousMins} min kørsel</span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    {/* Sequence number */}
                    {data.sequence < 999 && (
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center">
                        {data.sequence}
                      </span>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
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
                          className="w-28 h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
                          className="w-28 h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        />
                      </div>
                    </div>
                  </div>
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
