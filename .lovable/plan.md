

## Filter /alle-syn to show only unscheduled inspections

### What
Add a `.is("wf_shift_id", null)` filter to the Supabase query in `src/pages/AlleSyn.tsx` so only unscheduled inspections are displayed — matching the same logic used on the Inspections page.

### Change

**File: `src/pages/AlleSyn.tsx` (~line 55)**
- After `.select("*", { count: "exact" })`, add `.is("wf_shift_id", null)` to exclude items that have already been sent to WorkFeed.

One line added. No other files affected.

