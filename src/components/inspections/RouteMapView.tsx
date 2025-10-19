import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
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
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [12.5683, 55.6761], // Denmark center
      zoom: 7,
    });

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      "top-left"
    );

    // Cleanup
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.current?.remove();
    };
  }, [mapboxToken]);

  // Update markers and routes when data changes
  useEffect(() => {
    if (!map.current || inspectorRoutes.length === 0) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Remove existing route layers
    inspectorRoutes.forEach((route, index) => {
      const sourceId = `route-${route.inspector_id}`;
      if (map.current?.getLayer(sourceId)) {
        map.current.removeLayer(sourceId);
      }
      if (map.current?.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }
    });

    const allCoords: [number, number][] = [];

    // Add route lines and markers for each inspector
    inspectorRoutes.forEach((route, routeIndex) => {
      const color = INSPECTOR_COLORS[routeIndex % INSPECTOR_COLORS.length];
      const isRouteSelected =
        !selectedInspectorId || selectedInspectorId === route.inspector_id;

      // Create route line coordinates
      const coordinates: [number, number][] = [];
      route.assignments
        .sort((a, b) => a.sequence_in_route - b.sequence_in_route)
        .forEach((assignment) => {
          const inspection = inspectionsMap.get(assignment.inspection_id);
          if (inspection?.lat && inspection?.lng) {
            coordinates.push([inspection.lng, inspection.lat]);
            allCoords.push([inspection.lng, inspection.lat]);
          }
        });

      // Add route line
      if (coordinates.length > 1 && map.current) {
        map.current.addSource(`route-${route.inspector_id}`, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates,
            },
          },
        });

        map.current.addLayer({
          id: `route-${route.inspector_id}`,
          type: "line",
          source: `route-${route.inspector_id}`,
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": color,
            "line-width": selectedInspectorId === route.inspector_id ? 4 : 2,
            "line-opacity": isRouteSelected ? 1 : 0.6,
          },
        });
      }

      // Add numbered markers
      route.assignments.forEach((assignment) => {
        const inspection = inspectionsMap.get(assignment.inspection_id);
        if (!inspection?.lat || !inspection?.lng) return;

        // Create marker element
        const el = document.createElement("div");
        el.className = "cursor-pointer transition-all hover:scale-125";
        el.style.width = "32px";
        el.style.height = "32px";
        el.style.opacity = isRouteSelected ? "1" : "0.3";

        el.innerHTML = `
          <div style="
            width: 32px;
            height: 32px;
            background-color: ${color};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 14px;
            border: 2px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          ">
            ${assignment.sequence_in_route}
          </div>
        `;

        // Create popup
        const popup = new mapboxgl.Popup({
          offset: 25,
          closeButton: false,
          closeOnClick: false,
        }).setHTML(`
          <div style="padding: 8px; min-width: 200px;">
            <div style="font-size: 12px; font-weight: 600; margin-bottom: 4px;">
              ${assignment.inspector_name}
            </div>
            <div style="font-size: 11px; color: #666; margin-bottom: 2px;">
              ${inspection.address}
            </div>
            <div style="font-size: 11px; color: #666; margin-bottom: 2px;">
              ${inspection.inspection_type}
            </div>
            <div style="font-size: 11px; font-weight: 500; margin-top: 4px;">
              ${assignment.start_time} - ${assignment.end_time}
            </div>
          </div>
        `);

        // Create marker
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([inspection.lng, inspection.lat])
          .setPopup(popup)
          .addTo(map.current!);

        // Show popup on hover
        el.addEventListener("mouseenter", () => {
          popup.addTo(map.current!);
        });

        el.addEventListener("mouseleave", () => {
          popup.remove();
        });

        markersRef.current.push(marker);
      });
    });

    // Fit map to show all markers
    if (allCoords.length > 0 && map.current) {
      const lngs = allCoords.map((c) => c[0]);
      const lats = allCoords.map((c) => c[1]);

      map.current.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 50, duration: 1000 }
      );
    }
  }, [inspectorRoutes, inspectionsMap, selectedInspectorId]);

  // Zoom to selected inspector route
  useEffect(() => {
    if (!map.current || !selectedInspectorId) return;

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

    map.current.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 80, duration: 800 }
    );
  }, [selectedInspectorId, inspectorRoutes, inspectionsMap]);

  return (
    <div className="relative h-[600px] w-full rounded-lg overflow-hidden border">
      <div ref={mapContainer} className="absolute inset-0" />

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
