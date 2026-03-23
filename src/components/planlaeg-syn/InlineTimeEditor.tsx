import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Clock, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateEndTime, getEffectiveDuration } from "@/lib/inspection-duration";
import type { MondayItem } from "@/lib/supabase";

interface InlineTimeEditorProps {
  inspection: MondayItem;
  scheduledTime?: { start: string; end: string };
  onTimeChange: (inspectionId: number, times: { start: string; end: string }) => void;
  compact?: boolean;
}

export function InlineTimeEditor({
  inspection,
  scheduledTime,
  onTimeChange,
  compact = false,
}: InlineTimeEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localStart, setLocalStart] = useState(scheduledTime?.start || "08:00");
  const [localEnd, setLocalEnd] = useState(scheduledTime?.end || "09:00");
  const startInputRef = useRef<HTMLInputElement>(null);

  // Sync local state when scheduledTime changes externally
  useEffect(() => {
    if (scheduledTime) {
      setLocalStart(scheduledTime.start);
      setLocalEnd(scheduledTime.end);
    }
  }, [scheduledTime]);

  // Focus start input when popover opens
  useEffect(() => {
    if (isOpen && startInputRef.current) {
      setTimeout(() => startInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleStartChange = (newStart: string) => {
    setLocalStart(newStart);
    // Auto-calculate end time based on inspection duration
    const newEnd = calculateEndTime(newStart, {
      synstype: inspection.synstype,
      antalVaerelser: inspection.antal_vaerelser,
      raw: inspection.raw,
    });
    setLocalEnd(newEnd);
  };

  const handleSave = () => {
    onTimeChange(inspection.id, { start: localStart, end: localEnd });
    setIsOpen(false);
  };

  const handleCancel = () => {
    // Reset to original values
    setLocalStart(scheduledTime?.start || "08:00");
    setLocalEnd(scheduledTime?.end || "09:00");
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  const duration = getEffectiveDuration(inspection);

  const hasTime = scheduledTime?.start && scheduledTime?.end;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
          }}
          className={cn(
            "flex items-center gap-1 rounded transition-colors",
            compact ? "px-1 py-0.5" : "px-2 py-1",
            hasTime 
              ? "font-mono text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground" 
              : "text-[10px] text-primary hover:bg-primary/10"
          )}
        >
          {hasTime ? (
            <>
              <span>{scheduledTime.start}</span>
              <span className="text-muted-foreground/50">-</span>
              <span>{scheduledTime.end}</span>
            </>
          ) : (
            <>
              <Clock className="h-3 w-3" />
              <span>Tilføj tid</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-64 p-3" 
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground truncate max-w-full">
            {inspection.adresse}
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Start</label>
              <Input
                ref={startInputRef}
                type="time"
                value={localStart}
                onChange={(e) => handleStartChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Slut</label>
              <Input
                type="time"
                value={localEnd}
                onChange={(e) => setLocalEnd(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-8 text-sm font-mono"
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Varighed: {duration} min
            </span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                className="h-7 px-2"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                className="h-7 px-2"
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
