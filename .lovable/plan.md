## Root cause
Inspector pins live on a Mapbox symbol layer, which is subject to symbol-placement/collision culling and zoom-based hiding. Blue/green pins use `mapboxgl.Marker` DOM elements (immune to culling) and never disappear. `icon-allow-overlap` + `icon-ignore-placement` didn't hold — likely async image-load race or layout props not applying at runtime. Fix: eliminate the symbol layer for inspectors and use DOM markers like blue/green.

## Change scope
Single file: `src/components/planlaeg-syn/PlanlaegSynMapView.tsx`.

## Edits

1. **Inside `apply()`, under `if (showInspectors) { ... }`** — replace the GeoJSON source + symbol/badge layer block with `inspectorPoints.forEach(p => ...)`:
   - Build a `<div>` with `position:relative; width:24px; height:34px; cursor:pointer`.
   - Inner HTML: 24×34 SVG teardrop (fill `INSPECTOR_COLOR`, white stroke, white center dot) + when `bookedCount > 0`, an absolutely-positioned `<span>` badge (top:-8, right:-8, dark bg, white text, white border).
   - `new mapboxgl.Marker({ element: el, anchor: "bottom" }).setLngLat([p.lng, p.lat]).setPopup(new mapboxgl.Popup({ offset: 28 }).setHTML(popupHtml)).addTo(map)`.
   - Push to `markersRef`, extend `bounds`, set `hasAny = true`.

2. **Drop the `else { setInspectorLayersVisible(map, false) }` branch** — `markersRef` is cleared at the top of `apply()`, so toggle-off works naturally.

3. **Delete dead code**:
   - `ensureInspectorPinImage` (function + call)
   - `ensureInspectorLayers` (function + call)
   - `setInspectorLayersVisible`
   - `inspectorHandlersBoundRef`, `inspectorPopupRef`, `inspectorPinReadyRef`
   - The `map.on("click"/"mouseenter"/"mouseleave", "inspectors-home-icon")` handlers (popup now handled by marker's `setPopup`)
   - `MutableRefObject` import (no longer used)

## Drift guards (both hold after the change)
- **Anchor**: `anchor: "bottom"` and element height = SVG height = 34px. The badge is `position: absolute` so it does NOT extend the box downward — the element's bottom edge equals the pin tip. No compensating pixel offset.
- **Geometry**: `setLngLat([p.lng, p.lat])` reads only the static home coordinate from `inspectorPoints` (built from `inspectorCoords`). Booking coords feed only `bookedCount`, never geometry. No `project`/`unproject` round-trips.

## Verification
- Continuous zoom out → in → out: every inspector pin stays visible the whole time.
- Toggle "Vis konsulenter" off → all gone; on → all return.
- For ~3 inspectors, `marker.getLngLat()` matches their Supabase `inspectors.lat/lng`; pin stays glued through full zoom cycle.
- A plain blue `mapboxgl.Marker` at the same coordinate coincides with the orange pin at every zoom.
- Badge shows correct count and never displaces the pin.

## Out of scope
Blue inspection markers, green booked-shift markers, clustering, filters bar, map init/error handling.
