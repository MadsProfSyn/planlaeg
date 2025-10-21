import { Clock, MapPin, User } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { RouteOverviewCard } from "./RouteOverviewCard";
import type { InspectorRouteSummary } from "@/types/vrp";
import { cn } from "@/lib/utils";

interface InspectorRouteGroupProps {
  inspectorRoute: InspectorRouteSummary;
  inspectionsMap: Map<string, any>;
  isSelected?: boolean;
  onSelect?: () => void;
  roundtripEnabled?: boolean;
}

export function InspectorRouteGroup({
  inspectorRoute,
  inspectionsMap,
  isSelected = false,
  onSelect,
  roundtripEnabled = false,
}: InspectorRouteGroupProps) {
  return (
    <Collapsible defaultOpen={true} className="border rounded-lg">
      <CollapsibleTrigger
        className={cn(
          "w-full p-4 hover:bg-muted/50 transition-colors cursor-pointer",
          isSelected && "bg-primary/10 border-l-4 border-l-primary"
        )}
        onClick={onSelect}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-primary" />
            <div className="text-left">
              <div className="font-semibold text-base">
                {inspectorRoute.inspector_name}
              </div>
              
              {inspectorRoute.base_address && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <MapPin className="h-3 w-3" />
                  <span>Base: {inspectorRoute.base_address}</span>
                </div>
              )}
              
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
                  {roundtripEnabled && inspectorRoute.roundtrip_distance_km != null
                    ? `${inspectorRoute.roundtrip_distance_km.toFixed(1)} km (retur inkl.)`
                    : `${inspectorRoute.total_distance_km.toFixed(1)} km`
                  }
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
