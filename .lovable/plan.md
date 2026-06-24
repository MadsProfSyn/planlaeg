## Goal
Extend the Kort tab on `/planlaeg-syn` with a third toggle for already-booked inspections (from WorkFeed) and add a "booked count" badge on inspector markers.

All data needed is already loaded — the `inspectors` array from `PlanlaegSyn.tsx` already carries `scheduled_shifts` (count) and `shift_details[]` (each with `type`, `start_time`, `end_time`, `duration_minutes`, `address`, `lat`, `lng`). No new queries or backend work needed.

## Changes (frontend only)

### 1. `src/components/planlaeg-syn/PlanlaegSynMapView.tsx`

**Add third toggle "Vis planlagte syn"**
- New state `showBookedShifts`, default `false` (off by default per request).
- Render checkbox in the toggle row, same pattern as the two existing ones, with a distinct color (green `#10B981`) and count = total booked shifts across all visible inspectors.

**New marker set: booked shifts**
- Derive `bookedShiftPoints` via `useMemo` by flattening `inspectors[].shift_details`, keeping only entries with valid `lat`/`lng`. For each, capture: inspector name (`inspector.navn`), inspection type (`shift.type`), `start_time`, `end_time`, `duration_minutes`, `address`.
- When `showBookedShifts` is true, render these as green pins. Popup shows:
  - Inspector name (bold)
  - Inspection type (e.g. "FF", "IF" — reuse existing abbreviation labels)
  - Time range `HH:MM - HH:MM` and duration (e.g. "60 min")
  - Address

**Inspector marker badge ("X booked")**
- Render inspector markers as custom HTML elements (use `new mapboxgl.Marker({ element })` instead of the default color marker) so we can overlay a small circular badge in the top-right showing `inspector.scheduled_shifts` when > 0.
- Badge style: small amber/primary circle with white number, similar visual weight to the count badges already used in the Planlægning tab.
- Popup unchanged except we append "Planlagte syn: N" line.

**Filter integration**
- All three marker sets continue to respect the existing `selectedDate`, `landsdel`, and `afdeling` filters because they operate on the already-filtered `inspections` and `inspectors` props passed from `PlanlaegSyn.tsx`. No prop changes needed.

**fitBounds**
- Extend bounds calculation to also include `bookedShiftPoints` when that toggle is on.

### 2. `src/pages/PlanlaegSyn.tsx`
- No logic change required. `PlanlaegSynMapView` already receives `inspectors` (which includes `scheduled_shifts` and `shift_details`). No new props needed.

## Out of scope (for this step)
- No new tabs, routes, or DB queries.
- No changes to the Planlægning tab.
- Click-to-highlight / route lines / hover sync between markers are deferred to the follow-up step you mentioned.
