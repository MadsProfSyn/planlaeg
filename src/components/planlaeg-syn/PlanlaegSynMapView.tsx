import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { AlertCircle, MapPin } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { MondayItem } from "@/lib/supabase";
import type { Inspector } from "@/pages/PlanlaegSyn";

interface PlanlaegSynMapViewProps {
  selectedDate: string | undefined;
  inspections: MondayItem[];
  inspectors: Inspector[];
  inspectorCoords: Map<string, { lat: number; lng: number }>;
}

const INSPECTION_COLOR = "#3B82F6"; // blue
const INSPECTOR_COLOR = "#F59E0B"; // amber

export function PlanlaegSynMapView({
  selectedDate,
  inspections,
  inspectors,
  inspectorCoords,
}: PlanlaegSynMapViewProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [initError, setInitError] = useState<string | null>(null);
  const [showInspections, setShowInspections] = useState(true);
  const [showInspectors, setShowInspectors] = useState(true);

  // Build point sets
  const inspectionPoints = useMemo(
    () =>
      inspections
        .filter((i) => typeof i.lat === "number" && typeof i.lng === "number")
        .map((i) => ({
          id: i.id,
          lat: i.lat as number,
          lng: i.lng as number,
          title: i.Kunde || i.adresse || "Synsopgave",
          subtitle: i.adresse || "",
          extra: i.synstype || "",
        })),
    [inspections]
  );

  const inspectorPoints = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{
      id: string;
      lat: number;
      lng: number;
      title: string;
      subtitle: string;
      extra: string;
    }> = [];
    inspectors.forEach((ins) => {
      if (seen.has(ins.inspector_uuid)) return;
      const c = inspectorCoords.get(ins.inspector_uuid);
      if (!c) return;
      seen.add(ins.inspector_uuid);
      out.push({
        id: ins.inspector_uuid,
        lat: c.lat,
        lng: c.lng,
        title: ins.navn,
        subtitle: ins.adresse || "",
        extra: `${ins.afdeling || ""} • ${ins.tidspunkt_label}`,
      });
    });
    return out;
  }, [inspectors, inspectorCoords]);

  // Init map once
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const token = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;
    if (!token || !token.startsWith("pk.")) {
      setInitError(
        "Ugyldig Mapbox token. Tilføj VITE_MAPBOX_PUBLIC_TOKEN i din .env."
      );
      return;
    }
    mapboxgl.accessToken = token;

    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [10.5, 56], // Denmark
      zoom: 6,
    });
    mapRef.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Render markers + fit bounds when data/toggles change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const bounds = new mapboxgl.LngLatBounds();
      let hasAny = false;

      const addMarker = (
        lng: number,
        lat: number,
        color: string,
        popupHtml: string
      ) => {
        const marker = new mapboxgl.Marker({ color })
          .setLngLat([lng, lat])
          .setPopup(new mapboxgl.Popup({ offset: 16 }).setHTML(popupHtml))
          .addTo(map);
        markersRef.current.push(marker);
        bounds.extend([lng, lat]);
        hasAny = true;
      };

      if (showInspections) {
        inspectionPoints.forEach((p) => {
          addMarker(
            p.lng,
            p.lat,
            INSPECTION_COLOR,
            `<div style="font-family:inherit;min-width:180px">
              <div style="font-weight:600;margin-bottom:2px">${escapeHtml(p.title)}</div>
              <div style="font-size:12px;color:#555">${escapeHtml(p.subtitle)}</div>
              ${p.extra ? `<div style="font-size:12px;color:#777;margin-top:4px">${escapeHtml(p.extra)}</div>` : ""}
            </div>`
          );
        });
      }

      if (showInspectors) {
        inspectorPoints.forEach((p) => {
          addMarker(
            p.lng,
            p.lat,
            INSPECTOR_COLOR,
            `<div style="font-family:inherit;min-width:180px">
              <div style="font-weight:600;margin-bottom:2px">${escapeHtml(p.title)}</div>
              <div style="font-size:12px;color:#555">${escapeHtml(p.subtitle)}</div>
              ${p.extra ? `<div style="font-size:12px;color:#777;margin-top:4px">${escapeHtml(p.extra)}</div>` : ""}
            </div>`
          );
        });
      }

      if (hasAny) {
        map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 400 });
      }
    };

    if (map.isStyleLoaded()) {
      apply();
    } else {
      map.once("load", apply);
    }
  }, [inspectionPoints, inspectorPoints, showInspections, showInspectors]);

  if (initError) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/30 rounded-lg border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          {initError}
        </div>
      </div>
    );
  }

  if (!selectedDate) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-muted/30 rounded-lg border text-muted-foreground">
        <MapPin className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">Vælg en dato for at se kortet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-inspections"
            checked={showInspections}
            onCheckedChange={(v) => setShowInspections(v === true)}
          />
          <Label htmlFor="show-inspections" className="flex items-center gap-2 cursor-pointer">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: INSPECTION_COLOR }}
            />
            Vis synsopgaver ({inspectionPoints.length})
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-inspectors"
            checked={showInspectors}
            onCheckedChange={(v) => setShowInspectors(v === true)}
          />
          <Label htmlFor="show-inspectors" className="flex items-center gap-2 cursor-pointer">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: INSPECTOR_COLOR }}
            />
            Vis konsulenter ({inspectorPoints.length})
          </Label>
        </div>
      </div>

      <div
        ref={mapContainer}
        className="flex-1 min-h-0 w-full rounded-lg border overflow-hidden"
      />
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}