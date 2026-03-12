

## Bug: React Error #31 — "object with keys {id, name}"

### Root Cause

**Query key collision** between two pages:

- `src/pages/Inspectors.tsx` (line 90): `queryKey: ["departments"]` → fetches from `departments` table, returns `[{id, name, ...}]`
- `src/pages/PlanlaegSyn.tsx` (line 173): `queryKey: ["departments"]` → fetches from edge function, maps to `string[]`

React Query caches the first result. If the user visits `/inspectors` before `/planlaeg-syn`, the cached `[{id, name}]` objects are used as `afdelinger` on PlanlaegSyn. The `PlanlaegSynFiltersBar` then renders `{afdeling}` (an object) as a React child inside `<SelectItem>`, causing React error #31.

### Fix

**File:** `src/pages/PlanlaegSyn.tsx`

Rename the query key from `["departments"]` to `["planlaeg-departments"]` (line 173) to avoid the cache collision with the Inspectors page.

One-line change, no other files affected.

