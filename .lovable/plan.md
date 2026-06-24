
## Goal

Add a tabbed view to `/planlaeg-syn` with a new **Kort** (map) view showing inspection locations (from Monday) and available inspectors' home addresses for the selected date, using the existing Mapbox setup.

## UX

- Add a `Tabs` switcher in the top-right of `/planlaeg-syn` header row (next to the action buttons): **Planlægning** (current two-panel view) and **Kort** (new map view).
- Both tabs share the existing filter bar (`Dato`, `Landsdel`, `Afdeling`) so switching tabs preserves filters.
- Date is required for the map (same as today's inspectors panel). If no date selected, show an empty state: "Vælg en dato for at se kortet."

### Map view layout

```
[Filter bar (date / landsdel / afdeling) — shared]
[Map toggles row: ☑ Vis synsopgaver  ☑ Vis konsulenter  •  legend]
[Mapbox map — fills remaining height]
```

- Two checkboxes/switches above the map to toggle layers on/off:
  - **Vis synsopgaver** (inspections) — default on
  - **Vis konsulenter** (inspectors) — default on
- Small legend chip explaining marker colors.
- Map auto-fits bounds to currently visible markers when filters or toggles change.
- Clicking a marker opens a Mapbox popup with key details (address, customer/synstype for inspections; name, afdeling, tidspunkt for inspectors).

### Filters

The existing `Landsdel` filter already scopes inspections; `Afdeling` already scopes inspectors. On the map both filters apply simultaneously so users see only the relevant subset. The new "Vis synsopgaver / Vis konsulenter" toggles are *additional* layer-visibility switches on top of those filters (not replacements).

## Technical Plan

### 1. New component: `src/components/planlaeg-syn/PlanlaegSynMapView.tsx`

Props:
```ts
{
  selectedDate: string | undefined;
  inspections: MondayItem[];   // already filtered by date+landsdel
  inspectors: Inspector[];     // already filtered by date+afdeling
  inspectorCoords: Map<string, { lat: number; lng: number }>;
}
```

- Reuses the Mapbox pattern from `RouteMapView.tsx`:
  - `mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN`
  - Same style, same error state when token missing.
- Renders two marker layers:
  - **Inspections** — colored circle markers (e.g. blue) at `monday_items_selected.lat/lng`.
  - **Inspectors** — differently colored markers (e.g. amber) at inspector home `lat/lng`.
- Local state for `showInspections`, `showInspectors` (both default true).
- Auto-fit bounds to the visible set on changes.
- Empty / loading states when no coordinates resolve.

### 2. Inspector coordinates

`inspectors` (from `supabase_availability` + `inspectors`) currently fetches `address` but not `lat/lng`. Extend the inspectors query in `PlanlaegSyn.tsx` to also select `lat, lng` from the `inspectors` table and pass them via a `Map<inspectorId, {lat,lng}>` (or add to the `Inspector` interface). No DB change needed — `inspectors.lat/lng` already exists and is populated by the geocode flow.

### 3. Inspection coordinates

`monday_items_selected` already carries `lat`/`lng` (populated by `geocode-monday-items` trigger). Confirm `getMondayItems` returns these fields; if not, add them to the select. No new fetch needed.

### 4. Tabs integration in `PlanlaegSyn.tsx`

- Wrap the existing two-column DnD layout and the new map view in shadcn `Tabs` (`value`, `onValueChange` in component state, default `"plan"`).
- `TabsList` placed in the top action row on the right side (`Planlægning` / `Kort`).
- `TabsContent value="plan"` contains the existing `<DndContext>...</DndContext>` block, unchanged.
- `TabsContent value="map"` contains `<PlanlaegSynMapView ... />`.
- "Send til WorkFeed" / "Sync vagter" buttons remain visible in both tabs (they operate on shared state).

### 5. Files touched

- `src/pages/PlanlaegSyn.tsx` — add tab state, wrap views in `Tabs`, extend inspectors query with `lat/lng`.
- `src/components/planlaeg-syn/PlanlaegSynMapView.tsx` — **new**, Mapbox map with two toggle-able marker layers, popups, fit-bounds.
- (If needed) `src/lib/supabase.ts` — ensure `lat`/`lng` returned for monday items.

## Out of scope

- No drag-and-drop / scheduling from the map (read-only visualization).
- No driving-route rendering on this map (that lives in the route preview); we only plot points.
- No DB changes; no edge function changes.
