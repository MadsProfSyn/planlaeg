# Change inspector map marker to a person icon

## What changes
On `/planlaeg-syn` map, replace the orange teardrop pin SVG used for inspector home locations with a Lucide `User` icon, keeping the same orange color (`INSPECTOR_COLOR`) and existing badge for booked count.

## Where
`src/components/planlaeg-syn/PlanlaegSynMapView.tsx`, inside the `if (showInspectors && !routeMode)` block (around lines 300–323) where the inspector marker DOM element's `innerHTML` is built.

## How
- Replace the current teardrop `<svg>` (path + inner white circle) with the Lucide `User` SVG path, inlined as an SVG string so it stays in the marker's DOM injection (Mapbox markers are built via `innerHTML`, not React).
- Use the same 24×34 container so anchoring/positioning stays identical (`anchor: "bottom"`), meaning no drift changes.
  - Draw a filled orange circle background (r=12) centered in the box, with white stroke, matching current visual weight.
  - Overlay the Lucide `User` glyph in white on top (stroke=white, fill=none), sized ~16px, centered.
- Keep the booked-count badge markup unchanged.
- No changes to logic, state, popups, route mode, bounds fitting, or any other marker type (inspections, booked shifts).

## Out of scope
- No color changes (still `INSPECTOR_COLOR` orange).
- No changes to route-mode numbered markers, inspection pins, or booked-shift pins.
- No dependency additions — the raw SVG path from `lucide-react`'s `User` icon is inlined as a string (same icon set already used across the app).
