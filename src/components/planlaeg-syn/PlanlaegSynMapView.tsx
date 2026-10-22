import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { AlertCircle, Check, ChevronsUpDown, MapPin, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { buildDrivingPolylineWithLegs } from "@/lib/mapbox-directions";
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
const ROUTE_COLOR = "#8B5CF6"; // purple — distinctive for the "route mode" overlay

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
  const routeMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const routeAbortRef = useRef<AbortController | null>(null);
  const routeLayerIdsRef = useRef<string[]>([]);
  const [initError, setInitError] = useState<string | null>(null);
  const [showInspections, setShowInspections] = useState(true);
  const [showInspectors, setShowInspectors] = useState(true);
  const [showBookedShifts, setShowBookedShifts] = useState(false);
  const [selectedRouteInspectorId, setSelectedRouteInspectorId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [routeTotalKm, setRouteTotalKm] = useState<number | null>(null);
  const [routeStatus, setRouteStatus] = useState<"idle" | "loading" | "ready" | "empty">("idle");

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
          info: i.yderligere_info?.trim() || "",
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

  // Unique, sorted inspector list for the picker.
  const routePickerInspectors = useMemo(() => {
    const seen = new Set<string>();
    const list: Inspector[] = [];
    inspectors.forEach((i) => {
      if (seen.has(i.inspector_uuid)) return;
      seen.add(i.inspector_uuid);
      list.push(i);
    });
    return list.sort((a, b) => a.navn.localeCompare(b.navn, "da"));
  }, [inspectors]);

  const selectedRouteInspector = useMemo(
    () => routePickerInspectors.find((i) => i.inspector_uuid === selectedRouteInspectorId) || null,
    [routePickerInspectors, selectedRouteInspectorId]
  );

  // Clear route selection if the chosen inspector falls out of the list (date/filter change).
  useEffect(() => {
    if (selectedRouteInspectorId && !selectedRouteInspector) {
      setSelectedRouteInspectorId(null);
    }
  }, [selectedRouteInspectorId, selectedRouteInspector]);

  const routeMode = !!selectedRouteInspectorId;

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
          glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
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
      const message = e.error?.message || "";
      const fatal = /token|unauthorized|webgl|failed to initialize/i.test(message);
      if (fatal) setInitError(message || "Kortet kunne ikke indlæses.");
      // layer/source/image/glyph errors are logged, not surfaced as a full-screen error card
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
              ${(p as { info?: string }).info ? `<div title="${escapeHtml((p as { info?: string }).info!)}" style="font-size:12px;color:#555;margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">ℹ︎ ${escapeHtml((p as { info?: string }).info!)}</div>` : ""}
            </div>`
          );
        });
      }

      if (showInspectors && !routeMode) {
        // Render inspector home pins as DOM markers (same path as blue/green),
        // which are immune to Mapbox symbol-layer culling at any zoom level.
        // Drift guards:
        //   - anchor: "bottom" with element height === SVG height (34px). The
        //     badge is position:absolute so it does NOT extend the box, keeping
        //     the bottom edge = pin tip. No compensating pixel offset.
        //   - Geometry comes ONLY from the static home lngLat. Booking coords
        //     (shift_details) feed bookedCount only, never geometry.
        inspectorPoints
          .filter((p) => Number.isFinite(p.lng) && Number.isFinite(p.lat))
          .forEach((p) => {
            const el = document.createElement("div");
            // IMPORTANT: do NOT set position/top/left/margin/transform/transition
            // on the element passed to mapboxgl.Marker — Mapbox owns its
            // positioning via .mapboxgl-marker { position:absolute } +
            // transform:translate(...). Overriding position breaks drift-free
            // tracking. The badge's positioning context lives on an inner div.
            el.style.cursor = "pointer";
            el.innerHTML = `
              <div style="position:relative;width:24px;height:34px;">
                <svg width="24" height="34" viewBox="0 0 24 34" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="11.25" fill="${INSPECTOR_COLOR}" stroke="#ffffff" stroke-width="1.5"/>
                  <g transform="translate(4 4)" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M16 14v-1a4 4 0 0 0-4-4H4a4 4 0 0 0-4 4v1"/>
                    <circle cx="8" cy="4" r="4"/>
                  </g>
                </svg>
                ${
                  p.bookedCount > 0
                    ? `<span style="position:absolute;top:-8px;right:-8px;min-width:18px;height:18px;
                        padding:0 4px;border-radius:9px;background:#1F2937;color:#fff;font-size:11px;
                        font-weight:700;line-height:18px;text-align:center;border:1.5px solid #fff;
                        box-sizing:border-box;">${p.bookedCount}</span>`
                    : ""
                }
              </div>
            `;

            const popupHtml = `<div style="font-family:inherit;min-width:180px">
              <div style="font-weight:600;margin-bottom:2px">${escapeHtml(p.title)}</div>
              <div style="font-size:12px;color:#555">${escapeHtml(p.subtitle)}</div>
              ${p.extra ? `<div style="font-size:12px;color:#777;margin-top:4px">${escapeHtml(p.extra)}</div>` : ""}
              <div style="font-size:12px;color:#111;margin-top:6px"><strong>Planlagte syn:</strong> ${p.bookedCount}</div>
            </div>`;

            const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
              .setLngLat([p.lng, p.lat])
              .setPopup(new mapboxgl.Popup({ offset: 28 }).setHTML(popupHtml))
              .addTo(map);

            markersRef.current.push(marker);
            bounds.extend([p.lng, p.lat]);
            hasAny = true;
          });
      }

      if (showBookedShifts && !routeMode) {
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
        // Don't auto-fit while route mode owns the camera.
        if (!routeMode) {
          map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 400 });
        }
      }
    };

    if (map.isStyleLoaded()) {
      apply();
    } else {
      map.once("load", apply);
    }
  }, [inspectionPoints, inspectorPoints, bookedShiftPoints, showInspections, showInspectors, showBookedShifts, routeMode]);

  // Route-mode overlay: numbered markers + driving polyline for the chosen inspector.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clean previous overlay first.
    const cleanup = () => {
      routeAbortRef.current?.abort();
      routeAbortRef.current = null;
      routeMarkersRef.current.forEach((m) => m.remove());
      routeMarkersRef.current = [];
      routeLayerIdsRef.current.forEach((id) => {
        try {
          if (map.getLayer(id)) map.removeLayer(id);
          if (map.getSource(id)) map.removeSource(id);
        } catch {/* ignore */}
      });
      routeLayerIdsRef.current = [];
    };
    cleanup();

    if (!selectedRouteInspector) {
      setRouteTotalKm(null);
      setRouteStatus("idle");
      return;
    }

    const base = inspectorCoords.get(selectedRouteInspector.inspector_uuid);
    const shifts = (selectedRouteInspector.shift_details || [])
      .filter((s) => typeof s.lat === "number" && typeof s.lng === "number")
      .slice()
      .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

    if (!base && shifts.length === 0) {
      setRouteTotalKm(null);
      setRouteStatus("empty");
      return;
    }

    const apply = async () => {
      const token = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;

      // Base (home) marker — black home pin, consistent with RouteMapView.
      if (base) {
        const el = document.createElement("div");
        el.style.cursor = "pointer";
        el.innerHTML = `
          <div style="width:30px;height:30px;border-radius:50%;background:#111;color:#fff;
            display:flex;align-items:center;justify-content:center;border:2px solid #fff;
            box-shadow:0 2px 6px rgba(0,0,0,0.35);font-size:14px;line-height:1;">🏠</div>
        `;
        const popup = new mapboxgl.Popup({ offset: 18 }).setHTML(
          `<div style="font-family:inherit;min-width:180px">
            <div style="font-weight:600;margin-bottom:2px">Base: ${escapeHtml(selectedRouteInspector.navn)}</div>
            <div style="font-size:12px;color:#555">${escapeHtml(selectedRouteInspector.adresse || "")}</div>
          </div>`
        );
        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([base.lng, base.lat])
          .setPopup(popup)
          .addTo(map);
        routeMarkersRef.current.push(marker);
      }

      // Group shifts by coordinate so overlapping pins can be fanned out.
      const coordGroups = new Map<string, number[]>();
      shifts.forEach((s, idx) => {
        const key = `${(s.lat as number).toFixed(6)},${(s.lng as number).toFixed(6)}`;
        const arr = coordGroups.get(key) ?? [];
        arr.push(idx);
        coordGroups.set(key, arr);
      });
      const markerOffsets = new Map<number, [number, number]>();
      coordGroups.forEach((idxs) => {
        if (idxs.length === 1) {
          markerOffsets.set(idxs[0], [0, 0]);
          return;
        }
        const radius = 14;
        idxs.forEach((idx, i) => {
          const angle = -Math.PI / 2 + (2 * Math.PI * i) / idxs.length;
          markerOffsets.set(idx, [radius * Math.cos(angle), radius * Math.sin(angle)]);
        });
      });

      // Numbered shift markers.
      shifts.forEach((s, idx) => {
        const number = idx + 1;
        const el = document.createElement("div");
        el.style.cursor = "pointer";
        el.innerHTML = `
          <div style="position:relative;width:30px;height:30px;">
            <div style="position:absolute;inset:0;border-radius:50%;background:${ROUTE_COLOR};
              color:#fff;display:flex;align-items:center;justify-content:center;border:2px solid #fff;
              box-shadow:0 2px 6px rgba(0,0,0,0.35);font-size:13px;font-weight:700;line-height:1;">
              ${number}
            </div>
          </div>
        `;
        const typeLabel = TYPE_LABEL[s.type] || s.type || "Syn";
        const timeLine =
          s.start_time && s.end_time
            ? `${(s.start_time || "").substring(0, 5)} - ${(s.end_time || "").substring(0, 5)}${s.duration_minutes ? ` (${s.duration_minutes} min)` : ""}`
            : "";
        const popup = new mapboxgl.Popup({ offset: 18 }).setHTML(
          `<div style="font-family:inherit;min-width:200px">
            <div style="font-weight:600;margin-bottom:2px">${number}. ${escapeHtml(typeLabel)}</div>
            ${timeLine ? `<div style="font-size:12px;color:#555;margin-top:2px">${escapeHtml(timeLine)}</div>` : ""}
            ${s.address ? `<div style="font-size:12px;color:#777;margin-top:4px">${escapeHtml(s.address)}</div>` : ""}
          </div>`
        );
        const offset = markerOffsets.get(idx) ?? [0, 0];
        const marker = new mapboxgl.Marker({ element: el, anchor: "center", offset })
          .setLngLat([s.lng as number, s.lat as number])
          .setPopup(popup)
          .addTo(map);
        routeMarkersRef.current.push(marker);
      });

      // Fit to all points.
      const bounds = new mapboxgl.LngLatBounds();
      if (base) bounds.extend([base.lng, base.lat]);
      shifts.forEach((s) => bounds.extend([s.lng as number, s.lat as number]));
      try {
        map.fitBounds(bounds, { padding: 80, maxZoom: 13, duration: 500 });
      } catch {/* ignore — single point */}

      // Build the driving polyline (base → 1 → 2 → ... → N → base) so the
      // total km includes the return-to-base leg.
      const waypoints: [number, number][] = [];
      if (base) waypoints.push([base.lng, base.lat]);
      shifts.forEach((s) => waypoints.push([s.lng as number, s.lat as number]));
      if (base && shifts.length > 0) waypoints.push([base.lng, base.lat]);

      if (!token || !token.startsWith("pk.") || waypoints.length < 2) {
        setRouteTotalKm(null);
        setRouteStatus(shifts.length === 0 ? "empty" : "ready");
        return;
      }

      setRouteStatus("loading");
      const controller = new AbortController();
      routeAbortRef.current = controller;

      const built = await buildDrivingPolylineWithLegs(waypoints, token, controller.signal);
      if (controller.signal.aborted || !mapRef.current) return;

      const snappedFC = {
        type: "FeatureCollection" as const,
        features: built.legs
          .filter((l) => l.snapped)
          .map((l, i) => ({
            type: "Feature" as const,
            properties: { i },
            geometry: { type: "LineString" as const, coordinates: l.coords },
          })),
      };
      const fallbackFC = {
        type: "FeatureCollection" as const,
        features: built.legs
          .filter((l) => !l.snapped)
          .map((l, i) => ({
            type: "Feature" as const,
            properties: { i },
            geometry: { type: "LineString" as const, coordinates: l.coords },
          })),
      };

      const snappedId = "planlaeg-route-snapped";
      const fallbackId = "planlaeg-route-fallback";
      try {
        map.addSource(snappedId, { type: "geojson", data: snappedFC });
        map.addLayer({
          id: snappedId,
          type: "line",
          source: snappedId,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": ROUTE_COLOR, "line-width": 4, "line-opacity": 0.9 },
        });
        routeLayerIdsRef.current.push(snappedId);

        map.addSource(fallbackId, { type: "geojson", data: fallbackFC });
        map.addLayer({
          id: fallbackId,
          type: "line",
          source: fallbackId,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": ROUTE_COLOR,
            "line-width": 3,
            "line-opacity": 0.6,
            "line-dasharray": [2, 2],
          },
        });
        routeLayerIdsRef.current.push(fallbackId);
      } catch (e) {
        console.error("Failed to add route layers", e);
      }

      setRouteTotalKm(built.totalDistanceMeters > 0 ? built.totalDistanceMeters / 1000 : null);
      setRouteStatus("ready");
    };

    if (map.isStyleLoaded()) {
      apply();
    } else {
      map.once("load", apply);
    }

    return cleanup;
    // inspectorCoords is a Map; reference changes when data reloads.
  }, [selectedRouteInspector, inspectorCoords]);

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
      <div className="flex items-center gap-3 flex-wrap">
        <Label className="text-sm text-muted-foreground">Vis synskonsulentens rute:</Label>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={pickerOpen}
              className="w-[280px] justify-between"
              disabled={routePickerInspectors.length === 0}
            >
              <span className="truncate">
                {selectedRouteInspector ? selectedRouteInspector.navn : "Vælg synskonsulent…"}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Søg navn eller afdeling…" />
              <CommandList>
                <CommandEmpty>Ingen synskonsulenter fundet.</CommandEmpty>
                <CommandGroup>
                  {routePickerInspectors.map((ins) => (
                    <CommandItem
                      key={ins.inspector_uuid}
                      value={`${ins.navn} ${ins.afdeling || ""}`}
                      onSelect={() => {
                        setSelectedRouteInspectorId(ins.inspector_uuid);
                        setPickerOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedRouteInspectorId === ins.inspector_uuid ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="flex-1 truncate">{ins.navn}</span>
                      {ins.afdeling && (
                        <span className="ml-2 text-xs text-muted-foreground">{ins.afdeling}</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {selectedRouteInspector && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedRouteInspectorId(null)}
            className="h-8 px-2"
          >
            <X className="h-4 w-4 mr-1" />
            Ryd
          </Button>
        )}
        {routeMode && routeStatus === "loading" && (
          <span className="text-xs text-muted-foreground">Beregner rute…</span>
        )}
        {routeMode && routeStatus === "empty" && (
          <span className="text-xs text-muted-foreground">Ingen planlagte syn for denne dato.</span>
        )}
        {routeMode && routeStatus === "ready" && routeTotalKm != null && (
          <span
            className="text-xs font-medium px-2 py-1 rounded-md"
            style={{ backgroundColor: `${ROUTE_COLOR}1A`, color: ROUTE_COLOR }}
          >
            Total: {routeTotalKm.toFixed(1)} km kørt
          </span>
        )}
      </div>

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
            disabled={routeMode}
          />
          <Label htmlFor="show-inspectors" className={cn("flex items-center gap-2 cursor-pointer", routeMode && "opacity-50")}>
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
            disabled={routeMode}
          />
          <Label htmlFor="show-booked" className={cn("flex items-center gap-2 cursor-pointer", routeMode && "opacity-50")}>
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