import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Clock, Plus, X } from "lucide-react";
import { toast } from "sonner";

interface TimeRange {
  start_time: string;
  end_time: string;
}

interface TimeRangeManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultantName: string;
  existingRanges: TimeRange[];
  onSave: (ranges: TimeRange[]) => Promise<void>;
}

export function TimeRangeManager({
  open,
  onOpenChange,
  consultantName,
  existingRanges,
  onSave,
}: TimeRangeManagerProps) {
  const [ranges, setRanges] = useState<TimeRange[]>(
    existingRanges.length > 0 ? existingRanges : [{ start_time: "08:00", end_time: "16:00" }]
  );
  const [isSaving, setIsSaving] = useState(false);

  const validateTimeRange = (start: string, end: string): boolean => {
    const startHour = parseInt(start.split(":")[0]);
    const endHour = parseInt(end.split(":")[0]);
    const startMinute = parseInt(start.split(":")[1]);
    const endMinute = parseInt(end.split(":")[1]);

    // Check within working hours (08:00-18:00)
    if (startHour < 8 || startHour >= 18 || endHour < 8 || endHour > 18) {
      return false;
    }

    // Check end > start
    if (endHour < startHour || (endHour === startHour && endMinute <= startMinute)) {
      return false;
    }

    return true;
  };

  const checkOverlap = (ranges: TimeRange[]): boolean => {
    for (let i = 0; i < ranges.length; i++) {
      for (let j = i + 1; j < ranges.length; j++) {
        const range1 = ranges[i];
        const range2 = ranges[j];

        const start1 = range1.start_time;
        const end1 = range1.end_time;
        const start2 = range2.start_time;
        const end2 = range2.end_time;

        // Check if ranges overlap
        if (
          (start1 >= start2 && start1 < end2) ||
          (end1 > start2 && end1 <= end2) ||
          (start2 >= start1 && start2 < end1) ||
          (end2 > start1 && end2 <= end1)
        ) {
          return true;
        }
      }
    }
    return false;
  };

  const handleAddRange = () => {
    setRanges([...ranges, { start_time: "08:00", end_time: "16:00" }]);
  };

  const handleRemoveRange = (index: number) => {
    if (ranges.length === 1) {
      toast.error("Der skal være mindst ét tidsrum");
      return;
    }
    setRanges(ranges.filter((_, i) => i !== index));
  };

  const handleUpdateRange = (index: number, field: "start_time" | "end_time", value: string) => {
    const newRanges = [...ranges];
    newRanges[index][field] = value;
    setRanges(newRanges);
  };

  const handleSave = async () => {
    // Validate all ranges
    for (const range of ranges) {
      if (!validateTimeRange(range.start_time, range.end_time)) {
        toast.error("Alle tidsrum skal være mellem 08:00 og 18:00, og sluttid skal være efter starttid");
        return;
      }
    }

    // Check for overlaps
    if (checkOverlap(ranges)) {
      toast.error("Tidsrum må ikke overlappe hinanden");
      return;
    }

    setIsSaving(true);
    try {
      await onSave(ranges);
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving time ranges:", error);
      toast.error("Kunne ikke gemme tidsrum");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Administrer tidsrum for {consultantName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Tilføj et eller flere tidsrum mellem 08:00 og 18:00. Tidsrum må ikke overlappe.
          </p>

          {ranges.map((range, index) => (
            <div key={index} className="flex items-end gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor={`start-${index}`}>Fra</Label>
                <input
                  id={`start-${index}`}
                  type="time"
                  min="08:00"
                  max="18:00"
                  step="300"
                  value={range.start_time}
                  onChange={(e) => handleUpdateRange(index, "start_time", e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="flex-1 space-y-2">
                <Label htmlFor={`end-${index}`}>Til</Label>
                <input
                  id={`end-${index}`}
                  type="time"
                  min="08:00"
                  max="18:00"
                  step="300"
                  value={range.end_time}
                  onChange={(e) => handleUpdateRange(index, "end_time", e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveRange(index)}
                disabled={ranges.length === 1}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddRange}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Tilføj tidsrum
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Annuller
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Gemmer..." : "Gem tidsrum"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
