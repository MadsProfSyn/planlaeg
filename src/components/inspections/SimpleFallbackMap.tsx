import { Badge } from "@/components/ui/badge";
import { MapPin, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InspectorRouteSummary } from "@/types/vrp";

const INSPECTOR_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316",
];

interface SimpleFallbackMapProps {
  inspectorRoutes: InspectorRouteSummary[];
  selectedInspectorId: string | null;
  inspectionsMap: Map<string, any>;
  onInspectorSelect: (id: string | null) => void;
}

export function SimpleFallbackMap({
  inspectorRoutes,
  selectedInspectorId,
  inspectionsMap,
  onInspectorSelect,
}: SimpleFallbackMapProps) {
  return (
    <div className="h-[600px] border rounded-lg bg-muted/10 p-4 overflow-auto">
      <div className="mb-4 p-3 bg-primary/10 rounded-lg text-sm">
        <p className="font-medium">📍 Rute oversigt (liste visning)</p>
        <p className="text-xs text-muted-foreground mt-1">
          Klik på en synskonsulent for at se deres rute
        </p>
      </div>

      <div className="space-y-4">
        {inspectorRoutes.map((route, routeIndex) => {
          const color = INSPECTOR_COLORS[routeIndex % INSPECTOR_COLORS.length];
          const isSelected = !selectedInspectorId || selectedInspectorId === route.inspector_id;

          return (
            <div
              key={route.inspector_id}
              className={cn(
                "border rounded-lg p-4 transition-all",
                selectedInspectorId === route.inspector_id && "ring-2 ring-primary shadow-md",
                !isSelected && "opacity-50"
              )}
            >
              <button
                onClick={() => onInspectorSelect(
                  selectedInspectorId === route.inspector_id ? null : route.inspector_id
                )}
                className="w-full text-left"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-6 h-6 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-semibold text-lg">{route.inspector_name}</span>
                  <Badge variant="secondary" className="ml-auto">
                    {route.total_inspections} syn
                  </Badge>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {route.total_time_mins} min
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {route.total_distance_km.toFixed(1)} km
                  </div>
                </div>
              </button>

              {(selectedInspectorId === route.inspector_id || !selectedInspectorId) && (
                <div className="space-y-2 pl-2 border-l-2" style={{ borderColor: color }}>
                  {route.assignments
                    .sort((a, b) => a.sequence_in_route - b.sequence_in_route)
                    .map((assignment) => {
                      const inspection = inspectionsMap.get(assignment.inspection_id);
                      if (!inspection) return null;

                      return (
                        <div
                          key={assignment.inspection_id}
                          className="flex items-start gap-3 p-3 rounded-lg bg-background hover:bg-muted/50 transition-colors"
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md"
                            style={{ backgroundColor: color }}
                          >
                            {assignment.sequence_in_route}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {inspection.address}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <Badge variant="outline" className="text-xs">
                                {inspection.inspection_type}
                              </Badge>
                              <span>•</span>
                              <span>
                                {assignment.start_time} - {assignment.end_time}
                              </span>
                            </div>
                            {assignment.travel_from_previous_mins > 0 && (
                              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {assignment.travel_from_previous_mins} min rejsetid
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
