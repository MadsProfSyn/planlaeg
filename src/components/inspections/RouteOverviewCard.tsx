import { Clock, MapPin, MoveRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { VrpAssignment } from "@/types/vrp";

interface RouteOverviewCardProps {
  assignment: VrpAssignment;
  sequence: number;
  address?: string;
}

export function RouteOverviewCard({ assignment, sequence, address }: RouteOverviewCardProps) {
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

          {/* Time range */}
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>
              {assignment.start_time} - {assignment.end_time}
            </span>
          </div>

          {/* Travel time */}
          {assignment.travel_from_previous_mins > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MoveRight className="h-4 w-4" />
              <span>{assignment.travel_from_previous_mins} min kørsel</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
