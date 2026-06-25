## Goal
On `/planlaeg-syn` → Kort tab, the purple "Total: X km kørt" should reflect the full roundtrip including the drive from the last inspection back to the inspector's home base.

## Change
In `src/components/planlaeg-syn/PlanlaegSynMapView.tsx`, route-mode waypoint construction (around lines 486–489):

Currently: `base → shift 1 → shift 2 → … → shift N`

Update to: `base → shift 1 → … → shift N → base`

This means appending the base coordinate as the final waypoint when a base exists and there is at least one shift. `buildDrivingPolylineWithLegs` will then return one additional leg (last shift → base), which automatically:
- extends the purple polyline back to the home pin
- increases `routeTotalKm` to include the return leg

## Edge cases
- No base coordinate: behavior unchanged (no closing leg can be drawn).
- Zero shifts: behavior unchanged (no route).
- Bounds fitting already includes base, so no change needed there.

## Out of scope
No changes to data fetching, the Planlægning tab, or the VRP "Ruter" view. Frontend-only edit to a single file.