import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { calculateEndTime, calculateInspectionDuration } from "@/lib/inspection-duration";
import type { MondayItem } from "@/lib/supabase";

interface ScheduleTimesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspectorName: string;
  inspections: MondayItem[];
  existingTimes: Map<number, { start: string; end: string }>;
  onSave: (times: Map<number, { start: string; end: string }>) => void;
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

export function ScheduleTimesDialog({
  open,
  onOpenChange,
  inspectorName,
  inspections,
  existingTimes,
  onSave,
}: ScheduleTimesDialogProps) {
  // Local state for editing times (both start and end)
  const [localTimes, setLocalTimes] = useState<Map<number, { start: string; end: string }>>(new Map());

  // Initialize local times when dialog opens
  useEffect(() => {
    if (open) {
      const initialTimes = new Map<number, { start: string; end: string }>();
      let nextStartTime = "08:00";

      inspections.forEach((inspection) => {
        const existing = existingTimes.get(inspection.id);
        if (existing) {
          initialTimes.set(inspection.id, { start: existing.start, end: existing.end });
          nextStartTime = existing.end;
        } else {
          const endTime = calculateEndTime(nextStartTime, {
            synstype: inspection.synstype,
            antalVaerelser: inspection.antal_vaerelser,
            raw: inspection.raw,
          });
          initialTimes.set(inspection.id, { start: nextStartTime, end: endTime });
          nextStartTime = endTime;
        }
      });

      setLocalTimes(initialTimes);
    }
  }, [open, inspections, existingTimes]);

  const handleStartTimeChange = (inspectionId: number, newStartTime: string, inspection: MondayItem) => {
    setLocalTimes((prev) => {
      const next = new Map(prev);
      // Auto-calculate new end time based on new start
      const newEndTime = calculateEndTime(newStartTime, {
        synstype: inspection.synstype,
        antalVaerelser: inspection.antal_vaerelser,
        raw: inspection.raw,
      });
      next.set(inspectionId, { start: newStartTime, end: newEndTime });
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
          <div className="space-y-3">
            {inspections.map((inspection) => {
              const abbr = getTypeAbbreviation(inspection.synstype);
              const times = localTimes.get(inspection.id) || { start: "08:00", end: "09:00" };
              const duration = calculateInspectionDuration({
                synstype: inspection.synstype,
                antalVaerelser: inspection.antal_vaerelser,
                raw: inspection.raw,
              });

              return (
                <div
                  key={inspection.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {inspection.adresse || "Ukendt adresse"}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={cn("text-[10px] px-1.5 py-0", getTypeColor(abbr))}>
                        {abbr}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {inspection.antal_vaerelser ?? "?"} vær.
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({duration} min)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex flex-col items-center">
                      <label 
                        htmlFor={`start-${inspection.id}`}
                        className="text-[10px] text-muted-foreground mb-0.5"
                      >
                        Start
                      </label>
                      <input
                        id={`start-${inspection.id}`}
                        type="time"
                        value={times.start}
                        onChange={(e) => handleStartTimeChange(inspection.id, e.target.value, inspection)}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        className="w-28 h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      />
                    </div>
                    <span className="text-muted-foreground mt-4">→</span>
                    <div className="flex flex-col items-center">
                      <label 
                        htmlFor={`end-${inspection.id}`}
                        className="text-[10px] text-muted-foreground mb-0.5"
                      >
                        Slut
                      </label>
                      <input
                        id={`end-${inspection.id}`}
                        type="time"
                        value={times.end}
                        onChange={(e) => handleEndTimeChange(inspection.id, e.target.value)}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        className="w-28 h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuller
          </Button>
          <Button onClick={handleSave}>Gem tidspunkter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
