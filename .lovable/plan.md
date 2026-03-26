## Drag-to-reorder stops in InspectorsPanel

### Summary

Add @dnd-kit/sortable drag reordering to the per-inspector stop list. When a stop is dragged to a new position, recalculate all times for that inspector using cascade logic. No backend changes.

### Key challenge: nested DnD contexts

The page already has a `DndContext` in `PlanlaegSyn.tsx` for dragging inspections onto inspectors. The stop reordering needs its own independent `DndContext` inside each `DroppableInspector`. @dnd-kit supports nested contexts — the inner sortable context will handle stop reordering, while the outer context handles inspection-to-inspector assignment. The `distance: 8` sensor on the outer context already prevents conflicts.

### Changes

`**src/components/planlaeg-syn/InspectorsPanel.tsx**` (sole file changed)

1. **New imports**: `SortableContext`, `useSortable`, `verticalListSortingStrategy`, `arrayMove` from `@dnd-kit/sortable`, `DndContext`, `closestCenter`, `PointerSensor`, `useSensor`, `useSensors` from `@dnd-kit/core`, `CSS` from `@dnd-kit/utilities`, `GripVertical`, `AlertTriangle`, `RotateCcw` from `lucide-react`, `getEffectiveDuration` from `@/lib/inspection-duration`
2. **New `SortableStopRow` component**: Wraps each existing stop row `<div>` with `useSortable`. Adds a `GripVertical` drag handle on the left (only for non-existing items). Existing/booked items are not sortable.
3. `**manualOrder` state** in `DroppableInspector`: `useState<number[] | null>(null)` — an ordered array of `monday_item_id`s, or `null` meaning "use Railway order". Initialized from `routeData.stops` sorted by sequence when route data arrives (only if `manualOrder` is currently `null`).
4. **Sorting logic change**: Replace the current inline sort-by-sequence with: if `manualOrder` is set, sort `assignedItems` by index in `manualOrder`; otherwise sort by `routeStop.sequence` as today.
5. **Inner `DndContext` + `SortableContext**` wrapping the stop list items (not the booked shifts). Uses its own `PointerSensor` with `distance: 5`. On `onDragEnd`:
  - Call `arrayMove` on the current order to get `newOrder`
  - Set `manualOrder` to `newOrder`
  - Cascade-recalculate times:
    - Stop 0: keep its current `scheduledTimes` start; end = start + duration
    - Stop N (N>0): find `travel_from_previous_mins` from `routeData` for that item's `monday_item_id`, start = roundUp5(prev end + travel), end = start + duration
  - Write all recalculated times into `onUpdateScheduledTimes` as a single Map (marks them as manual overrides, which is correct)
6. **Amber badge**: When `manualOrder !== null`, show a small amber badge on the inspector card header: "⚠️ Rækkefølge justeret manuelt"
7. **Reset link**: Next to the amber badge, a "Nulstil rækkefølge" text button. On click: set `manualOrder` to `null`, and re-apply original Railway times for this inspector's items via `onAutoScheduledTimes` (which skips manual overrides — so we also clear those items from `manualTimeOverrides`). To support clearing manual overrides, add a new optional prop `onClearManualOverrides?: (ids: number[]) => void` passed from `PlanlaegSyn.tsx`.
8. **Cascade helper** (local function in the file):
  ```ts
   function recalculateCascade(
     orderedItems: MondayItem[],
     scheduledTimes: Map<number, {start: string; end: string}>,
     routeData: InspectorRoute | undefined
   ): Map<number, {start: string; end: string}>
  ```
   Uses `getEffectiveDuration` for duration, `roundToNearest5` (copied from ScheduleTimesDialog — 1-liner), and `timeToMinutes`/`minutesToTime` helpers.

`**src/pages/PlanlaegSyn.tsx**` (minor addition)

- Add `handleClearManualOverrides` callback that removes given IDs from `manualTimeOverrides` set
- Pass it to `InspectorsPanel` as `onClearManualOverrides`
- Pass `onAutoScheduledTimes` (already passed) for the reset to re-apply Railway times

### What stays unchanged

- `useRouteOptimizer.ts` — no changes
- `handleSendToWorkfeed` — reads from `scheduledTimes` which already reflects reordered times
- Railway backend, Supabase writes, WorkFeed payload structure
- `ScheduleTimesDialog` / `InlineTimeEditor` — continue working as before