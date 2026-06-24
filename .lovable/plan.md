## Goal

On `/planlaeg-syn` → Kort-fanen, let the user search/pick a specific synskonsulent. When picked, show that inspector's currently booked shifts for the selected date as **numbered markers (1, 2, 3 …)** in shift-start order, connected by the **actual driving route** (Mapbox Directions API), starting from the inspector's home base.

## Do we already have the data?

Yes — no schema changes needed.

- `inspectors[]` (loaded in `PlanlaegSyn.tsx` via `fetch-available-inspectors` + `inspector_capacity_view`) already includes `shift_details: { type, start_time, end_time, duration_minutes, address, lat, lng }[]` per inspector.
- `inspectorCoords: Map<inspector_uuid, {lat,lng}>` already provides the home base coordinate (from `inspectors.lat/lng`).
- Both are passed into `PlanlaegSynMapView` today.
- Mapbox token `VITE_MAPBOX_PUBLIC_TOKEN` is already used elsewhere in the app and supports the Directions API.

So a real driving polyline (not bird-flight) is fully achievable client-side. The existing `src/components/inspections/RouteMapView.tsx` already implements this exact pattern (per-leg Directions calls + in-memory cache + snapped/fallback layers) — we'll reuse that approach.

## UX

Add a single control row above the existing checkbox legend in `PlanlaegSynMapView`:

```
[ Vis synskonsulentens rute: <Combobox: search inspector…>  (×) ]
```

- Combobox built from shadcn `Command` + `Popover` (the project already uses this pattern). Source = the `inspectors` list already passed in, sorted by name. Searchable by name and afdeling.
- Empty by default. Picking an inspector activates "route mode". An "×" clears it.
- While route mode is active:
  - Hide the general orange inspector pins and green booked-shift pins (blue inspection pins stay, controlled by their checkbox as today — they're useful context).
  - Show one black home-base marker (🏠) at the inspector's coordinate.
  - Show one numbered circle marker per booked shift, colored per inspector (single color, e.g. amber `#F59E0B`), labeled `1..N` in `start_time` order. Popup: type, time range, address.
  - Draw the driving polyline base → shift 1 → shift 2 → … → shift N. No return-to-base leg (keep it simple; route ends at last booking).
  - Auto-fitBounds to the route.
- If the inspector has zero shifts for the selected date, show a small inline notice ("Ingen planlagte syn for denne dato") and just center on their base.

## Technical details

File-level changes:

### 1. `src/components/planlaeg-syn/PlanlaegSynMapView.tsx`

- Add `selectedRouteInspectorId: string | null` local state.
- Add the Command/Popover combobox in the controls row.
- New `useEffect` (or extend the existing markers effect) that, when `selectedRouteInspectorId` is set:
  - Resolves base coord from `inspectorCoords`.
  - Builds an ordered waypoint array `[base, ...shift_details sorted by start_time].filter(has lat/lng)`.
  - Calls a shared `buildDrivingPolylineWithLegs(coords, token, signal)` helper to get snapped legs.
  - Adds two GeoJSON line layers (`route-selected-snapped` solid, `route-selected-fallback` dashed) — same approach as `RouteMapView`.
  - Adds numbered DOM markers (same drift-safe rules already documented in this file: don't set position/transform on the element passed to `mapboxgl.Marker`; numbering lives on an inner div).
  - Cleans up layers/sources/markers and aborts in-flight fetches on change/unmount.
- When `selectedRouteInspectorId` is set, suppress the existing `showInspectors` and `showBookedShifts` rendering branches (keep `showInspections` honoring its checkbox).

### 2. Extract shared route helper (small refactor, optional but clean)

- Move `fetchLeg` / `buildDrivingPolylineWithLegs` / `directionsCache` from `RouteMapView.tsx` into a new `src/lib/mapbox-directions.ts` and import from both places. If we want to avoid touching `RouteMapView.tsx`, we can copy the helper into `PlanlaegSynMapView.tsx` instead — call it out before implementing.

### 3. No other files

- No DB migration. No edge function changes. No changes to `PlanlaegSyn.tsx` props — `inspectors` and `inspectorCoords` are already passed in.

## Out of scope (call out)

- Drag-to-reorder of the route, "what-if" planning, or saving a custom order — this view is read-only "see what they're driving".
- Travel-time / km totals overlay — easy follow-up if wanted (Directions API already returns it; we'd just need to sum and render a small badge).
- Return-to-base leg — easy toggle to add later.

Open questions before I build:

1. Single color for the numbered markers (amber `#F59E0B` to stay consistent with the existing "inspector" color), or a different distinctive color so the route reads as a separate mode?
2. Should the existing orange inspector pins + green booked-shift pins be **hidden** while route mode is active (my recommendation), or stay visible underneath?
3. Add a small "Total: X km · Y min" badge from the Directions response, or skip for v1?  
  
Answers to questions:   
1. Add a distintintive color to the route.   
2. your recommendation - hide while the route mode is active  
3. Add a small "Total: x km driven - no y min badge