import { GripVertical, UserCog, MapPin, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProposedAssignment } from "@/lib/scheduled";
import { format } from "date-fns";
import { da } from "date-fns/locale";

interface InspectionCardProps {
  assignment: ProposedAssignment;
  isDragging?: boolean;
  onReassign: () => void;
}

export function InspectionCard({ assignment, isDragging, onReassign }: InspectionCardProps) {
  const isManual = assignment.assignment_source === "manual";

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      Proforma: "bg-blue-500/10 text-blue-700 border-blue-500/20",
      Projektsyn: "bg-purple-500/10 text-purple-700 border-purple-500/20",
      Indflytningssyn: "bg-green-500/10 text-green-700 border-green-500/20",
      Fraflytningssyn: "bg-orange-500/10 text-orange-700 border-orange-500/20",
    };
    return colors[type] || "bg-muted text-muted-foreground";
  };

  return (
    <div
      className={`
        group relative rounded-lg border bg-card p-4 transition-all
        ${isManual ? "border-l-4 border-l-primary" : "border-l-4 border-l-success"}
        ${isDragging ? "opacity-50 shadow-lg scale-105" : "hover:shadow-md"}
      `}
    >
      <div className="flex items-start gap-3">
        <div className="cursor-grab active:cursor-grabbing mt-1">
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge className="text-xs">#{assignment.sequence_in_route}</Badge>
              {isManual ? (
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                  Manuelt tildelt
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                  VRP planlagt
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <span className="text-sm font-medium">{assignment.inspection_address}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-muted-foreground">
                {assignment.start_time?.slice(0, 5)} - {assignment.end_time?.slice(0, 5)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Badge variant="outline" className={getTypeColor(assignment.inspection_type || "")}>
              {assignment.inspection_type}
            </Badge>

            <Button
              size="sm"
              variant="ghost"
              onClick={onReassign}
              className="h-8 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <UserCog className="h-4 w-4 mr-1" />
              Skift inspektør
            </Button>
          </div>

          {isManual && assignment.manual_override_at && (
            <div className="text-xs text-muted-foreground pt-1 border-t">
              Manuelt ændret {format(new Date(assignment.manual_override_at), "d. MMM yyyy 'kl.' HH:mm", { locale: da })}
              {assignment.manual_override_user_name && ` af ${assignment.manual_override_user_name}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
