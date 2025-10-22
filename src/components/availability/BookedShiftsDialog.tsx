import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDateForDisplay } from "@/lib/date-utils";
import { Clock, MapPin } from "lucide-react";

interface ShiftDetail {
  type: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  address?: string;
}

interface BookedShiftsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspectorName: string;
  date: string;
  shifts: ShiftDetail[];
}

// Helper to format time from "HH:MM:SS" to "HH:MM"
function formatTime(timeStr: string): string {
  if (!timeStr) return "";
  return timeStr.substring(0, 5);
}

// Helper to get color styling for inspection type
function getTypeColor(type: string): string {
  const typeMap: Record<string, string> = {
    FF: "bg-[#1e3a8a] text-black", // Dark blue
    IF: "bg-[#93c5fd] text-black", // Light blue
    PS: "bg-[#92400e] text-black", // Brown
    PA: "bg-[#9333ea] text-black", // Purple
    TMS: "bg-[#ea580c] text-black", // Orange
    AS: "bg-[#dc2626] text-black", // Red
  };
  return typeMap[type] || "bg-muted text-black";
}

export function BookedShiftsDialog({
  open,
  onOpenChange,
  inspectorName,
  date,
  shifts,
}: BookedShiftsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Bookede syn for {inspectorName} — {formatDateForDisplay(date)}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {shifts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Ingen bookede syn
            </p>
          ) : (
            shifts.map((shift, index) => (
              <div
                key={index}
                className="p-4 border rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    {/* Type badge */}
                    <div className="flex items-center gap-2">
                      <Badge className={`text-sm ${getTypeColor(shift.type)}`}>
                        {shift.type}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {shift.duration_minutes} min
                      </span>
                    </div>
                    
                    {/* Time range */}
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                      </span>
                    </div>
                    
                    {/* Address if available */}
                    {shift.address && (
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>{shift.address}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
