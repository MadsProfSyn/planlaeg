

## New "Alle syn" Page — Monday Items Overview with Editable Duration

### Summary
Create a new page at `/alle-syn` that shows all items from `monday_items_selected` (including those already sent to WorkFeed). Users can view and edit item data inline, including a new `duration_minutes` column that auto-calculates from synstype/rooms/DYMO but can be manually overridden.

### Database Change
**Migration: Add `duration_minutes` column to `monday_items_selected`**
```sql
ALTER TABLE monday_items_selected
ADD COLUMN duration_minutes integer;
```
- Nullable, no default — when NULL, the UI computes from `calculateInspectionDuration()`.
- When user overrides, store their value here.

### Files to Create

**1. `src/pages/AlleSyn.tsx`**
- Fetches ALL items from `monday_items_selected` (no `wf_shift_id IS NULL` filter — unlike Inspections page).
- Pagination, search (Kunde, adresse, lejemalsnr), date filter, region filter.
- Table columns in order: Kunde, Adresse, Synstype, Dato/tid, Antal værelser, Note (extracted from `raw.Note`), Duration (minutes).
- Each row is editable — clicking edit opens a dialog (reuse/extend `MondayItemDialog` pattern) where user can change any field including duration override.
- Duration column shows: stored `duration_minutes` if set, otherwise auto-calculated value with a subtle "(auto)" label.
- Saving duration writes to the new `duration_minutes` column.

**2. `src/components/alle-syn/AlleSynTable.tsx`**
- Table component with sortable columns for the 7 fields.
- Extracts Note from `raw?.Note`.
- Shows duration with auto/manual indicator.
- Edit and delete action buttons per row.

**3. `src/components/alle-syn/AlleSynFiltersBar.tsx`**
- Search input, date filter, region select, clear all — same pattern as `InspectionsFiltersBar`.

**4. `src/components/alle-syn/EditMondayItemDialog.tsx`**
- Dialog with all 7 editable fields including duration_minutes.
- Duration field shows placeholder with auto-calculated value.
- If user clears duration, it reverts to auto-calculation.

### Files to Modify

**5. `src/App.tsx`**
- Add route: `/alle-syn` → `<AlleSyn />` (protected, with AppLayout).

**6. `src/components/AppSidebar.tsx`**
- Add nav item "Alle syn" at position 3 (after "Planlæg syn (Manuelt)"), icon: `List` from lucide-react.

**7. `src/lib/supabase.ts`**
- Add `getAllMondayItems()` function — same as `getMondayItems()` but without the `.is("wf_shift_id", null)` filter, so it returns ALL items.
- Add `duration_minutes` to `MondayItem` interface.

**8. `src/lib/inspection-duration.ts`**
- No changes needed — reuse `calculateInspectionDuration()` for auto-calculation in the UI.

### Technical Details
- The `duration_minutes` column integrates with the existing scheduling flow: when set, `send-manual-shifts-to-workfeed` and VRP calculations should prefer the stored value over auto-calculation.
- Note extraction: `typeof raw === "string" ? JSON.parse(raw)?.Note : raw?.Note`.
- Search matches against Kunde, adresse, and lejemalsnr (same as existing pattern).

