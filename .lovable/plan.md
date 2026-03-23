

## "Syn variabler" Admin Page

### Overview
Create an admin page at `/admin/syn-variabler` that lets users edit the base duration matrix stored in `inspection_durations`, plus the bonus minute modifiers (DYMO, Cylinderskift). Changes propagate to Railway automatically (it reads the table). The frontend also needs to read from this table instead of hardcoded values.

### Current State
- `inspection_durations` table exists with 24 rows (4 types x 6 rooms)
- Frontend `inspection-duration.ts` has hardcoded switch statements duplicating these values
- Railway reads from the DB table — already dynamic
- The table has NO RLS policies — needs SELECT for authenticated, UPDATE for admin

### Changes

**1. Database: Add RLS to `inspection_durations`**
- Enable RLS on `inspection_durations`
- Add SELECT policy for authenticated users
- Add UPDATE policy for admin role only
- Add a primary key or unique constraint if missing (needed for upsert)

**2. New page: `src/pages/admin/SynVariabler.tsx`**
- Fetch all rows from `inspection_durations` on mount
- Display an editable table/grid: rows = room counts (1-6), columns = inspection types (FF, IF, PS, PA)
- Each cell is an editable number input showing minutes
- A separate section for bonus modifiers: DYMO (+X min) and Cylinderskift (+X min) — these could be stored as special rows or a separate small config table
- Save button that updates changed rows via Supabase
- Admin-only access

**3. Add route and navigation**
- `src/App.tsx`: Add route `/admin/syn-variabler` wrapped in `AdminRoute`
- `src/components/AppSidebar.tsx`: Add "Syn variabler" to `adminNavigationItems` with a `Settings` or `Clock` icon

**4. Update frontend duration calculation: `src/lib/inspection-duration.ts`**
- Add a function `fetchDurationMatrix()` that reads from `inspection_durations` table and caches in memory
- Update `calculateInspectionDuration()` to use the cached matrix instead of hardcoded switch statements
- Fallback to current hardcoded values if fetch fails

### Technical Details

The editable grid will look like:

```text
         FF    IF    PS    PA
1 rum  [ 65] [ 35] [ 35] [ 35]
2 rum  [ 75] [ 45] [ 45] [ 45]
3 rum  [ 80] [ 45] [ 45] [ 45]
4 rum  [ 90] [ 50] [ 50] [ 50]
5 rum  [ 90] [ 60] [ 60] [ 60]
6 rum  [ 90] [ 65] [ 65] [ 65]

Tillæg:
DYMO:            [ 5] min (IF/PS)
Cylinderskift:  [10] min (IF/PS)
```

For the bonus modifiers (DYMO/Cylinderskift minutes), we can either:
- Store them as special rows in `inspection_durations` with a sentinel room value (e.g. room=0, type="DYMO")
- Or create a tiny `inspection_duration_modifiers` table

The simpler approach is adding modifier rows to the existing table.

### Files to create/modify
- **Create** `src/pages/admin/SynVariabler.tsx` — the admin page
- **Modify** `src/App.tsx` — add route
- **Modify** `src/components/AppSidebar.tsx` — add nav item
- **Modify** `src/lib/inspection-duration.ts` — read from DB instead of hardcoded
- **Migration** — enable RLS + policies on `inspection_durations`, add PK if missing

