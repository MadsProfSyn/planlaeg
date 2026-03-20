

## Fix: Add "Trekantsområdet" to filter dropdowns on /availability and /planlaeg-syn

### Problem
"Trekantsområdet" exists in the `departments` table (used by `/inspectors`), but the `/availability` and `/planlaeg-syn` pages source their department/afdeling filters from the `afdeling_to_department` table via the `fetch-departments` edge function. That table currently only has 4 rows: Aalborg, Århus, Odense, Storkøbenhavn — missing Trekantsområdet.

### Fix
**1 migration file** — Insert the new row into `afdeling_to_department`:

```sql
INSERT INTO afdeling_to_department (afdeling, department)
VALUES ('Trekantsområdet', 'Trekantsområdet')
ON CONFLICT DO NOTHING;
```

This will make it appear automatically in both `/availability` and `/planlaeg-syn` filters since both use the `fetch-departments` edge function which reads from this table.

### Also included (from approved plan)

**Independent scrolling** — Update `src/pages/PlanlaegSyn.tsx` grid layout so both panels scroll independently.

**Drag cancel zone** — Add a droppable "cancel" area in `InspectionsPanel` during active drag, and update `handleDragEnd` to clear selection when dropped there or outside any inspector.

### Files changed
1. New migration — insert Trekantsområdet into `afdeling_to_department`
2. `src/pages/PlanlaegSyn.tsx` — grid layout fix, cancel drop handling
3. `src/components/planlaeg-syn/InspectionsPanel.tsx` — cancel drop zone UI

