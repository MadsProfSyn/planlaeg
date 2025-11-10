import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Clock, MapPin } from "lucide-react";

interface RouteTabSliderProps {
  routes: Array<{
    inspector_id: string;
    inspector_name: string;
    total_inspections: number;
    total_time_mins: number;
    total_distance_km: number;
  }>;
  selectedRouteIndex: number;
  onSelectRoute: (index: number) => void;
}

export function RouteTabSlider({
  routes,
  selectedRouteIndex,
  onSelectRoute,
}: RouteTabSliderProps) {
  return (
    <div id="ruter-top-slider" className="sticky top-0 z-10 bg-background border-b">
      <ScrollArea className="w-full">
        <div className="flex gap-2 p-4">
          {routes.map((route, index) => (
            <button
              key={route.inspector_id}
              onClick={() => onSelectRoute(index)}
              className={cn(
                "flex-shrink-0 px-4 py-3 rounded-lg border-2 transition-all hover:border-primary/50",
                selectedRouteIndex === index
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              )}
            >
              <div className="text-left">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">Rute {index + 1}</span>
                  <Badge variant="secondary" className="text-xs">
                    {route.total_inspections} syn
                  </Badge>
                </div>
                <p className="text-xs font-medium mb-1">{route.inspector_name}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {Math.round(route.total_time_mins)} min
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {route.total_distance_km.toFixed(1)} km
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
