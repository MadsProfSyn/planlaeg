import { useEffect, useState, useCallback } from "react";
import { GoogleMap, useJsApiLoader, Marker, Polyline, InfoWindow } from "@react-google-maps/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { InspectorRouteSummary } from "@/types/vrp";

interface RouteGoogleMapViewProps {
  inspectorRoutes: InspectorRouteSummary[];
  selectedInspectorId: string | null;
  inspectionsMap: Map<string, any>;
  onInspectorSelect: (inspectorId: string | null) => void;
  googleMapsApiKey: string;
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

const mapContainerStyle = {
  width: "100%",
  height: "600px",
};

const defaultCenter = {
  lat: 55.6761, // Denmark center
  lng: 12.5683,
};

export function RouteGoogleMapView({
  inspectorRoutes,
  selectedInspectorId,
  inspectionsMap,
  onInspectorSelect,
  googleMapsApiKey,
}: RouteGoogleMapViewProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [activeMarker, setActiveMarker] = useState<string | null>(null);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Fit bounds to show all markers
  useEffect(() => {
    if (!map || inspectorRoutes.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    inspectorRoutes.forEach((route) => {
      route.assignments.forEach((assignment) => {
        const inspection = inspectionsMap.get(assignment.inspection_id);
        if (inspection?.lat && inspection?.lng) {
          bounds.extend({ lat: inspection.lat, lng: inspection.lng });
          hasPoints = true;
        }
      });
    });

    if (hasPoints) {
      map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
    }
  }, [map, inspectorRoutes, inspectionsMap]);

  // Zoom to selected inspector route
  useEffect(() => {
    if (!map || !selectedInspectorId) return;

    const selectedRoute = inspectorRoutes.find(
      (r) => r.inspector_id === selectedInspectorId
    );
    if (!selectedRoute) return;

    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    selectedRoute.assignments.forEach((assignment) => {
      const inspection = inspectionsMap.get(assignment.inspection_id);
      if (inspection?.lat && inspection?.lng) {
        bounds.extend({ lat: inspection.lat, lng: inspection.lng });
        hasPoints = true;
      }
    });

    if (hasPoints) {
      map.fitBounds(bounds, { top: 80, bottom: 80, left: 80, right: 80 });
    }
  }, [selectedInspectorId, map, inspectorRoutes, inspectionsMap]);

  if (loadError) {
    return (
      <div className="h-[600px] border rounded-lg bg-muted/20 flex items-center justify-center">
        <p className="text-destructive">Fejl ved indlæsning af Google Maps</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="h-[600px] border rounded-lg bg-muted/20 flex items-center justify-center">
        <p className="text-muted-foreground">Indlæser Google Maps...</p>
      </div>
    );
  }

  return (
    <div className="relative h-[600px] w-full rounded-lg overflow-hidden border">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={defaultCenter}
        zoom={7}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        }}
      >
        {inspectorRoutes.map((route, routeIndex) => {
          const color = INSPECTOR_COLORS[routeIndex % INSPECTOR_COLORS.length];
          const isRouteSelected =
            !selectedInspectorId || selectedInspectorId === route.inspector_id;

          // Get route coordinates in order
          const path = route.assignments
            .sort((a, b) => a.sequence_in_route - b.sequence_in_route)
            .map((assignment) => {
              const inspection = inspectionsMap.get(assignment.inspection_id);
              return inspection?.lat && inspection?.lng
                ? { lat: inspection.lat, lng: inspection.lng }
                : null;
            })
            .filter((coord): coord is { lat: number; lng: number } => coord !== null);

          return (
            <div key={route.inspector_id}>
              {/* Route Polyline */}
              {path.length > 1 && (
                <Polyline
                  path={path}
                  options={{
                    strokeColor: color,
                    strokeWeight: selectedInspectorId === route.inspector_id ? 4 : 2,
                    strokeOpacity: isRouteSelected ? 1 : 0.6,
                  }}
                />
              )}

              {/* Numbered Markers */}
              {route.assignments.map((assignment) => {
                const inspection = inspectionsMap.get(assignment.inspection_id);
                if (!inspection?.lat || !inspection?.lng) return null;

                const markerId = `${route.inspector_id}-${assignment.inspection_id}`;
                const isActive = activeMarker === markerId;

                return (
                  <Marker
                    key={markerId}
                    position={{ lat: inspection.lat, lng: inspection.lng }}
                    onClick={() => setActiveMarker(isActive ? null : markerId)}
                    icon={{
                      path: google.maps.SymbolPath.CIRCLE,
                      fillColor: color,
                      fillOpacity: isRouteSelected ? 1 : 0.3,
                      strokeColor: "#ffffff",
                      strokeWeight: 2,
                      scale: 16,
                    }}
                    label={{
                      text: assignment.sequence_in_route.toString(),
                      color: "#ffffff",
                      fontWeight: "bold",
                      fontSize: "12px",
                    }}
                  >
                    {isActive && (
                      <InfoWindow
                        position={{ lat: inspection.lat, lng: inspection.lng }}
                        onCloseClick={() => setActiveMarker(null)}
                      >
                        <div style={{ padding: "8px", minWidth: "200px" }}>
                          <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                            {assignment.inspector_name}
                          </div>
                          <div style={{ fontSize: "11px", color: "#666", marginBottom: "2px" }}>
                            {inspection.address}
                          </div>
                          <div style={{ fontSize: "11px", color: "#666", marginBottom: "2px" }}>
                            {inspection.inspection_type}
                          </div>
                          <div style={{ fontSize: "11px", fontWeight: 500, marginTop: "4px" }}>
                            {assignment.start_time} - {assignment.end_time}
                          </div>
                        </div>
                      </InfoWindow>
                    )}
                  </Marker>
                );
              })}
            </div>
          );
        })}
      </GoogleMap>

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
                  backgroundColor: INSPECTOR_COLORS[index % INSPECTOR_COLORS.length],
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
