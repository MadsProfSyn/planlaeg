

## Fix Independent Scrolling on /planlaeg-syn

### Root Cause
The grid uses `lg:grid-cols-2` (breakpoint at 1024px). At the current preview viewport of ~673px, this falls back to single-column layout — both panels stack vertically and the whole page scrolls as one unit. The `overflow-hidden` and `h-full` constraints only work when both panels are side-by-side in a two-column grid.

### Fix
**1 file: `src/pages/PlanlaegSyn.tsx`** (line 690)

Change `grid-cols-1 lg:grid-cols-2` to `grid-cols-2` so the panels are always side-by-side regardless of viewport width. This ensures each panel stays within its column and scrolls independently via its internal `ScrollArea`.

