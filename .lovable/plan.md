## Problem

On the `/planlaeg-syn` route map, when Rasmus Kristiansen is selected on 2026-08-03, only 2 of his 4 numbered pins appear. The 4 shifts include two pairs sharing identical coordinates (Skovvejen 15 apt. 2.5 and 1.3 both geocode to 56.164395, 10.216678; Sønder Allé 9 3.tv and Amaliegade 20B 2.2 also collide). Mapbox stacks identical-coord markers so upper pins hide the ones underneath.

Backend is correct — the view returns all 4 shifts with valid lat/lng. Fix is rendering-only.

## Approach (Option A — fan out)

When 2+ numbered stops share the same coordinate, offset each marker by a small pixel amount arranged in a circle around the true point using Mapbox `Marker.setOffset({ x, y })`. This keeps the true `LngLat` (so the driving polyline still connects the real coordinate) but visually separates the pins so all are clickable.

## Changes

Two files, same shape of change:

1. `src/components/planlaeg-syn/PlanlaegSynMapView.tsx` — the numbered shifts loop around line 448.
2. `src/components/inspections/RouteMapView.tsx` — the numbered assignments loop around line 490.

In each:

- Before creating markers, group stops by a coordinate key (e.g. `${lat.toFixed(6)},${lng.toFixed(6)}`).
- For each group with size > 1, compute a per-marker pixel offset arranged evenly on a 14px-radius circle (angle = `(2π · i) / n`, starting at `-π/2` so the first pin sits directly above the true point).
- Pass `{ offset: [dx, dy] }` to the `mapboxgl.Marker({ element, anchor: "center", offset: [dx, dy] })` constructor.
- Groups of size 1 get `offset: [0, 0]` (unchanged behaviour).

Stop numbering stays sequential by `start_time` (already the case in both files — no change to sort order). The route polyline uses the true coordinates, unchanged.

## Acceptance

- Rasmus on 2026-08-03: all 4 numbered pins visible on the map — two pairs shown as fanned circles of 2 pins each.
- Each pin's popup opens correctly on hover and shows the right address including floor/door.
- Non-colliding routes look identical to today.
- Route polyline is unchanged (still connects the shared true coordinate).
- No changes to the SQL view, normalizer, or geocoding.
