import { useEffect, useRef, useState } from "react";
import Map, { Marker, Source, Layer, NavigationControl } from "react-map-gl";
import type { MapRef } from "react-map-gl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { InspectorRouteSummary } from "@/types/vrp";
import "mapbox-gl/dist/mapbox-gl.css";

interface RouteMapViewProps {
  inspectorRoutes: InspectorRouteSummary[];
  selectedInspectorId: string | null;
  inspectionsMap: Map<string, any>;
  onInspectorSelect: (inspectorId: string | null) => void;
  mapboxToken: string;
}

const INSPECTOR_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#14B8A6", // Teal
  "#F97316", // Orange
];

export function RouteMapView({
  inspectorRoutes,
  selectedInspectorId,
  inspectionsMap,
  onInspectorSelect,
  mapboxToken,
}: RouteMapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);

  // Calculate bounds and fit map
  useEffect(() => {
    if (!mapRef.current || inspectorRoutes.length === 0) return;

    const allCoords: [number, number][] = [];
    inspectorRoutes.forEach((route) => {
      route.assignments.forEach((assignment) => {
        const inspection = inspectionsMap.get(assignment.inspection_id);
        if (inspection?.lat && inspection?.lng) {
          allCoords.push([inspection.lng, inspection.lat]);
        }
      });
    });

    if (allCoords.length === 0) return;

    const lngs = allCoords.map((c) => c[0]);
    const lats = allCoords.map((c) => c[1]);

    mapRef.current.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 50, duration: 1000 }
    );
  }, [inspectorRoutes, inspectionsMap]);

  // Zoom to selected inspector route
  useEffect(() => {
    if (!mapRef.current || !selectedInspectorId) return;

    const selectedRoute = inspectorRoutes.find(
      (r) => r.inspector_id === selectedInspectorId
    );
    if (!selectedRoute) return;

    const coords: [number, number][] = [];
    selectedRoute.assignments.forEach((assignment) => {
      const inspection = inspectionsMap.get(assignment.inspection_id);
      if (inspection?.lat && inspection?.lng) {
        coords.push([inspection.lng, inspection.lat]);
      }
    });

    if (coords.length === 0) return;

    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);

    mapRef.current.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 80, duration: 800 }
    );
  }, [selectedInspectorId, inspectorRoutes, inspectionsMap]);

  // Generate GeoJSON for route lines
  const generateRouteGeoJSON = (route: InspectorRouteSummary) => {
    const coordinates = route.assignments
      .sort((a, b) => a.sequence_in_route - b.sequence_in_route)
      .map((assignment) => {
        const inspection = inspectionsMap.get(assignment.inspection_id);
        return [inspection?.lng, inspection?.lat];
      })
      .filter((coord) => coord[0] && coord[1]);

    return {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates,
      },
    };
  };

  return (
    <div className="relative h-[600px] w-full rounded-lg overflow-hidden border">
      <Map
        ref={mapRef}
        mapboxAccessToken={mapboxToken}
        initialViewState={{
          longitude: 12.5683,
          latitude: 55.6761,
          zoom: 7,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/light-v11"
      >
        <NavigationControl position="top-left" />

        {/* Route lines */}
        {inspectorRoutes.map((route, index) => {
          const isSelected = selectedInspectorId === route.inspector_id;
          const color = INSPECTOR_COLORS[index % INSPECTOR_COLORS.length];

          return (
            <Source
              key={`route-${route.inspector_id}`}
              id={`route-${route.inspector_id}`}
              type="geojson"
              data={generateRouteGeoJSON(route) as any}
            >
              <Layer
                id={`route-line-${route.inspector_id}`}
                type="line"
                paint={{
                  "line-color": color,
                  "line-width": isSelected ? 4 : 2,
                  "line-opacity": isSelected ? 1 : 0.6,
                }}
                layout={{
                  "line-join": "round",
                  "line-cap": "round",
                }}
              />
            </Source>
          );
        })}

        {/* Inspection markers */}
        {inspectorRoutes.map((route, routeIndex) => {
          const isRouteSelected =
            !selectedInspectorId || selectedInspectorId === route.inspector_id;
          const color = INSPECTOR_COLORS[routeIndex % INSPECTOR_COLORS.length];

          return route.assignments.map((assignment) => {
            const inspection = inspectionsMap.get(assignment.inspection_id);
            if (!inspection?.lat || !inspection?.lng) return null;

            const isHovered = hoveredMarkerId === assignment.inspection_id;

            return (
              <Marker
                key={assignment.inspection_id}
                longitude={inspection.lng}
                latitude={inspection.lat}
                anchor="center"
              >
                <div
                  className={cn(
                    "relative transition-all cursor-pointer",
                    isHovered && "scale-125"
                  )}
                  onMouseEnter={() => setHoveredMarkerId(assignment.inspection_id)}
                  onMouseLeave={() => setHoveredMarkerId(null)}
                  style={{ opacity: isRouteSelected ? 1 : 0.3 }}
                >
                  {/* Numbered circle marker */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg border-2 border-white"
                    style={{ backgroundColor: color }}
                  >
                    {assignment.sequence_in_route}
                  </div>

                  {/* Popup on hover */}
                  {isHovered && (
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-white rounded-lg shadow-xl p-3 min-w-[200px] z-50 border">
                      <div className="text-xs font-semibold text-foreground mb-1">
                        {assignment.inspector_name}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>{inspection.address}</div>
                        <div>{inspection.inspection_type}</div>
                        <div className="font-medium text-foreground">
                          {assignment.start_time} - {assignment.end_time}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Marker>
            );
          });
        })}
      </Map>

      {/* Inspector Legend */}
      <div className="absolute top-4 right-4 bg-background rounded-lg shadow-lg p-3 space-y-2 max-w-[250px] border">
        <div className="font-semibold text-sm mb-2">Synskonsulenter</div>
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {inspectorRoutes.map((route, index) => (
            <button
              key={route.inspector_id}
              onClick={() =>
                onInspectorSelect(
                  selectedInspectorId === route.inspector_id
                    ? null
                    : route.inspector_id
                )
              }
              className={cn(
                "flex items-center gap-2 w-full text-left p-2 rounded hover:bg-muted transition-colors",
                selectedInspectorId === route.inspector_id && "bg-primary/10"
              )}
            >
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{
                  backgroundColor:
                    INSPECTOR_COLORS[index % INSPECTOR_COLORS.length],
                }}
              />
              <span className="text-xs flex-1 truncate">
                {route.inspector_name}
              </span>
              <Badge variant="secondary" className="text-xs">
                {route.total_inspections}
              </Badge>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
