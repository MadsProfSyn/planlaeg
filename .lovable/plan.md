## Confirmed scope of the bug

Only the orange inspector markers drift. They are the only markers that:
- use a custom DOM element (40×40 box with absolutely-positioned SVG pin + count badge), and
- are tied to an inspector that also has an array of booking coordinates (`shift_details[*].lat/lng`).

Blue and green markers use plain `new mapboxgl.Marker({ color })` and never drift, so the bug is isolated to the orange element / its data flow.

## Investigation plan (must run before any code change)

Carried out by adding temporary logging + visual probes inside `src/components/planlaeg-syn/PlanlaegSynMapView.tsx`. Nothing else touched.

1. Log the exact lngLat passed to `new mapboxgl.Marker(...).setLngLat(...)` for the orange path, for the first ~3 inspectors. Compare against the raw `inspectors.lat/lng` rows in Supabase. Confirm the value is the static home coordinate and is not being mutated by the `shift_details` handling upstream (`src/pages/PlanlaegSyn.tsx` builds `inspectorCoords` from the `inspectors` table — verify nothing downstream rewrites it).

2. Grep the orange code path for `map.project`, `map.unproject`, any pixel offset between them, and any `reduce` / centroid / bbox computation over `shift_details`. The user-described symptom (correct at max zoom, drifts south on zoom-out, inspectors lined up vertically at Europe view) is the canonical signature of a `project → +pixelOffset → unproject` round-trip or an aggregate-of-coords geometry. Confirm whether such a path exists.

3. Probe the marker's effective anchor. Temporarily render, at the same home `lngLat`, a bare GeoJSON `circle` layer (Mapbox native, no DOM) alongside the orange marker. If the circle stays glued at all zooms while the orange pin drifts, the cause is in the orange DOM element (anchor/offset/box measurement). If both drift together, the cause is upstream in the geometry being passed in.

4. Reduce test: pass an orange marker only the home coord (no badge, no `shift_details` lookup at all). If drift disappears, the multi-coordinate/badge handling is confirmed as the cause.

5. Log `map.getZoom()` plus the marker's screen position (`map.project(homeLngLat)`) on every `zoom` event. The home lngLat must stay constant; the screen pixel must change smoothly with zoom — nothing must rewrite the marker's `lngLat` on zoom/move/render.

The fix below is applied only after step 2 or step 3/4 identifies which class of bug is in play.

## Fix (Mapbox-native, applied after root cause is confirmed)

Goal: the orange home pin's geographic position is exclusively the static home `lngLat` from the `inspectors` table, at every zoom, with no DOM-box or pixel-offset surprises.

1. Replace the custom-DOM orange marker with a Mapbox-native GeoJSON layer for the pin itself:
   - One GeoJSON source `inspectors-home` with one `Point` feature per inspector, geometry = `[home.lng, home.lat]`, properties = `{ inspector_uuid, name, bookedCount, ... }`.
   - One `symbol` layer using a registered SDF icon (orange teardrop) with `icon-anchor: "bottom"` and `icon-allow-overlap: true`. Mapbox handles reprojection at every zoom — no DOM box, no anchor ambiguity.
   - Click → popup keyed off the feature properties (same content as today).

2. Render the count badge as a second `symbol` layer on the same source:
   - `text-field: ["get", "bookedCount"]`, `text-anchor: "bottom"`, `text-offset: [0.9, -1.8]` (small pixel-style nudge relative to the icon; Mapbox keeps it tied to the same feature geometry, so it can never move the pin).
   - `filter: [">", ["get", "bookedCount"], 0]` so it only appears when the inspector has bookings.

3. Booking coordinates (`shift_details[*].lat/lng`) are used only to compute `bookedCount` in the GeoJSON properties. They never enter the geometry of any rendered feature. No booking pins are drawn (already the current behavior for the orange layer; keep it that way). The existing green "Vis planlagte syn" layer is untouched.

4. Remove the custom 40×40 DOM element entirely from the orange path. This eliminates every class of element-box / anchor / offset bug at once.

5. Keep blue inspections and green booked-shifts exactly as they are.

### If the investigation shows the cause is purely the DOM element (not a project/unproject round-trip)

Same fix is still correct and preferred — moving to a GeoJSON `symbol` layer permanently removes DOM-measurement risk. No intermediate "patch the element" attempt; we've already iterated on element padding/anchor/offset and the drift persists per the user.

## Validation

- Place an orange home pin and a plain blue `mapboxgl.Marker` at the exact same `lngLat`. Zoom from max-in to full-Europe and back. They must coincide and stay glued through the entire cycle.
- Pick 3 inspectors; verify the rendered home pin's `lngLat` (read back from the GeoJSON feature) equals their `inspectors.lat/lng` row in Supabase.
- Confirm the badge number is correct and that hiding/showing the orange layer never affects blue or green markers.
- Confirm the popup still shows name, address, department/time, and "Planlagte syn: N".

## Files touched

- `src/components/planlaeg-syn/PlanlaegSynMapView.tsx` — only file changed. Replace the orange custom-DOM marker path with a GeoJSON source + two symbol layers; keep blue/green paths and the toggle UI unchanged.
