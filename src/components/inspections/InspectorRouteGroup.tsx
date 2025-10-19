import { Clock, MapPin, User } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { RouteOverviewCard } from "./RouteOverviewCard";
import type { InspectorRouteSummary } from "@/types/vrp";

interface InspectorRouteGroupProps {
  inspectorRoute: InspectorRouteSummary;
  inspectionsMap: Map<string, any>;
}

export function InspectorRouteGroup({
  inspectorRoute,
  inspectionsMap,
}: InspectorRouteGroupProps) {
  return (
    <Collapsible defaultOpen={true} className="border rounded-lg">
      <CollapsibleTrigger className="w-full p-4 hover:bg-muted/50 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-primary" />
            <div className="text-left">
              <div className="font-semibold text-base">
                {inspectorRoute.inspector_name}
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Badge variant="secondary" className="font-normal">
                    {inspectorRoute.total_inspections} syn
                  </Badge>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {inspectorRoute.total_time_mins} min
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {inspectorRoute.total_distance_km.toFixed(1)} km
                </span>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="p-4 pt-0 space-y-3">
          {inspectorRoute.assignments.map((assignment, index) => {
            const inspection = inspectionsMap.get(assignment.inspection_id);
            return (
              <RouteOverviewCard
                key={assignment.inspection_id}
                assignment={assignment}
                sequence={assignment.sequence_in_route}
                address={inspection?.address}
              />
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
