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
const BOOKED_COLOR = "#10B981"; // green

const TYPE_LABEL: Record<string, string> = {
  FF: "Fraflytningssyn",
  IF: "Indflytningssyn",
  PS: "Projektsyn",
  PA: "Proforma",
};

export function PlanlaegSynMapView({
  selectedDate,
  inspections,
  inspectors,
  inspectorCoords,
}: PlanlaegSynMapViewProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [showInspections, setShowInspections] = useState(true);
  const [showInspectors, setShowInspectors] = useState(true);
  const [showBookedShifts, setShowBookedShifts] = useState(false);

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
      bookedCount: number;
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
        bookedCount: ins.scheduled_shifts ?? 0,
      });
    });
    return out;
  }, [inspectors, inspectorCoords]);

  const bookedShiftPoints = useMemo(() => {
    const out: Array<{
      key: string;
      lat: number;
      lng: number;
      inspectorName: string;
      type: string;
      start: string;
      end: string;
      duration: number;
      address: string;
    }> = [];
    inspectors.forEach((ins) => {
      (ins.shift_details || []).forEach((s, idx) => {
        if (typeof s.lat !== "number" || typeof s.lng !== "number") return;
        out.push({
          key: `${ins.inspector_uuid}-${idx}`,
          lat: s.lat,
          lng: s.lng,
          inspectorName: ins.navn,
          type: s.type || "",
          start: (s.start_time || "").substring(0, 5),
          end: (s.end_time || "").substring(0, 5),
          duration: s.duration_minutes || 0,
          address: s.address || "",
        });
      });
    });
    return out;
  }, [inspectors]);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const token = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;
    if (token?.startsWith("pk.")) {
      mapboxgl.accessToken = token;
    }

    let map: mapboxgl.Map;
    try {
      map = new mapboxgl.Map({
        container: mapContainer.current,
        projection: "mercator",
        style: {
          version: 8,
          sources: {
            "osm-tiles": {
              type: "raster",
              tiles: [
                "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
                "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
                "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
              ],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [
            {
              id: "osm-tiles",
              type: "raster",
              source: "osm-tiles",
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        },
        center: [12.5683, 55.6761], // Denmark
        zoom: 7,
      });
    } catch (err) {
      console.error("[PlanlaegSynMapView] Failed to create map", err);
      setInitError(err instanceof Error ? err.message : "Kortet kunne ikke indlæses.");
      return;
    }

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-left");

    map.on("load", () => map.resize());
    map.on("error", (e) => {
      console.warn("[PlanlaegSynMapView] mapbox error", e);
      const message = e.error?.message || "Kortet kunne ikke indlæses.";
      if (!message.toLowerCase().includes("tile")) {
        setInitError(message);
      }
    });

    // Ensure correct sizing even if container changes (tab switch, window resize)
    if (typeof ResizeObserver !== "undefined") {
      resizeObserverRef.current = new ResizeObserver(() => {
        mapRef.current?.resize();
      });
      resizeObserverRef.current.observe(mapContainer.current);
    }

    // Safety resize after first paint
    const t = window.setTimeout(() => map.resize(), 100);

    return () => {
      window.clearTimeout(t);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [selectedDate]);

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
          const el = document.createElement("div");
          el.style.cssText =
            "position:relative;width:24px;height:34px;cursor:pointer;";
          el.innerHTML = `
            <svg viewBox="0 0 24 34" width="24" height="34" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 22 12 22s12-13 12-22c0-6.6-5.4-12-12-12z" fill="${INSPECTOR_COLOR}" stroke="#fff" stroke-width="1.5"/>
              <circle cx="12" cy="12" r="4" fill="#fff"/>
            </svg>
            ${
              p.bookedCount > 0
                ? `<div style="position:absolute;top:-4px;right:-6px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#1F2937;color:#fff;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;border:1.5px solid #fff;box-sizing:border-box;line-height:1;">${p.bookedCount}</div>`
                : ""
            }
          `;
          const popupHtml = `<div style="font-family:inherit;min-width:180px">
            <div style="font-weight:600;margin-bottom:2px">${escapeHtml(p.title)}</div>
            <div style="font-size:12px;color:#555">${escapeHtml(p.subtitle)}</div>
            ${p.extra ? `<div style="font-size:12px;color:#777;margin-top:4px">${escapeHtml(p.extra)}</div>` : ""}
            <div style="font-size:12px;color:#111;margin-top:6px"><strong>Planlagte syn:</strong> ${p.bookedCount}</div>
          </div>`;
          const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
            .setLngLat([p.lng, p.lat])
            .setPopup(new mapboxgl.Popup({ offset: 16 }).setHTML(popupHtml))
            .addTo(map);
          markersRef.current.push(marker);
          bounds.extend([p.lng, p.lat]);
          hasAny = true;
        });
      }

      if (showBookedShifts) {
        bookedShiftPoints.forEach((p) => {
          const typeLabel = TYPE_LABEL[p.type] || p.type || "Syn";
          const timeLine =
            p.start && p.end
              ? `${p.start} - ${p.end}${p.duration ? ` (${p.duration} min)` : ""}`
              : p.duration
              ? `${p.duration} min`
              : "";
          addMarker(
            p.lng,
            p.lat,
            BOOKED_COLOR,
            `<div style="font-family:inherit;min-width:200px">
              <div style="font-weight:600;margin-bottom:2px">${escapeHtml(p.inspectorName)}</div>
              <div style="font-size:12px;color:#111">${escapeHtml(typeLabel)}</div>
              ${timeLine ? `<div style="font-size:12px;color:#555;margin-top:2px">${escapeHtml(timeLine)}</div>` : ""}
              ${p.address ? `<div style="font-size:12px;color:#777;margin-top:4px">${escapeHtml(p.address)}</div>` : ""}
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
  }, [inspectionPoints, inspectorPoints, bookedShiftPoints, showInspections, showInspectors, showBookedShifts]);

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
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-booked"
            checked={showBookedShifts}
            onCheckedChange={(v) => setShowBookedShifts(v === true)}
          />
          <Label htmlFor="show-booked" className="flex items-center gap-2 cursor-pointer">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: BOOKED_COLOR }}
            />
            Vis planlagte syn ({bookedShiftPoints.length})
          </Label>
        </div>
      </div>

      <div
        ref={mapContainer}
        className="flex-1 w-full rounded-lg border overflow-hidden min-h-[500px]"
        style={{ height: "calc(100vh - 260px)" }}
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