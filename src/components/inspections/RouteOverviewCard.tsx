import { Clock, MapPin, Car, Wrench } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { VrpAssignment } from "@/types/vrp";

interface RouteOverviewCardProps {
  assignment: VrpAssignment;
  sequence: number;
  address?: string;
}

// Helper function to add minutes to time string (HH:MM format)
function addMinutes(timeStr: string, minutes: number): string {
  const [hours, mins] = timeStr.split(':').map(Number);
  const totalMins = hours * 60 + mins;
  const newTotalMins = totalMins + minutes;
  const newHours = Math.floor(newTotalMins / 60) % 24;
  const newMins = newTotalMins % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
}

// Helper function to round time up to nearest 5-minute interval
function roundUpToNearest5(timeStr: string): string {
  const [hours, mins] = timeStr.split(':').map(Number);
  const roundedMins = Math.ceil(mins / 5) * 5;
  if (roundedMins === 60) {
    return `${String((hours + 1) % 24).padStart(2, '0')}:00`;
  }
  return `${String(hours).padStart(2, '0')}:${String(roundedMins).padStart(2, '0')}`;
}

// Helper function to calculate duration between two times in minutes
function getTimeDifference(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  return (endH * 60 + endM) - (startH * 60 + startM);
}

export function RouteOverviewCard({ assignment, sequence, address }: RouteOverviewCardProps) {
  // Calculate actual inspection times
  const arrivalTime = addMinutes(assignment.start_time, assignment.travel_from_previous_mins);
  const inspectionStartTime = roundUpToNearest5(arrivalTime);
  const inspectionDuration = getTimeDifference(assignment.start_time, assignment.end_time);
  const inspectionEndTime = addMinutes(inspectionStartTime, inspectionDuration);

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        {/* Numbered badge */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-base">
          {sequence}
        </div>

        {/* Content */}
        <div className="flex-1 space-y-2">
          {/* Inspector name */}
          <div className="font-semibold text-base">
            {assignment.inspector_name}
          </div>

          {/* Address */}
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{address || assignment.inspection_address}</span>
          </div>

          {/* Travel time - only show if > 0 */}
          {assignment.travel_from_previous_mins > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Car className="h-4 w-4" />
              <span>Rejsetid: {assignment.travel_from_previous_mins} min</span>
            </div>
          )}

          {/* Arrival time - calculated */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              Ankomst: {arrivalTime}
            </span>
          </div>

          {/* Inspection time */}
          <div className="flex items-center gap-2 text-sm font-medium">
            <Wrench className="h-4 w-4 text-primary" />
            <span>
              Syn: {inspectionStartTime} - {inspectionEndTime}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
