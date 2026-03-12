

## Fix: Show Loading Spinner on Every Inspection Assignment

### Problem

The loading spinner in the inspector card only appears for the first inspection placed. After the route optimizer returns data for that inspector, `routeData` is populated and the condition `!routeData` prevents the spinner from ever showing again.

### Root Cause

In `src/components/planlaeg-syn/InspectorsPanel.tsx`, the spinner rendering condition is:

```
isRouteLoading && assignedItems.length > 0 && !routeData
```

After the first route preview, `routeData` is no longer undefined, so `!routeData` is always `false`.

### Fix

**File:** `src/components/planlaeg-syn/InspectorsPanel.tsx`

Remove the `!routeData` condition from the loading spinner check so it becomes:

```
isRouteLoading && assignedItems.length > 0
```

This ensures the spinner shows whenever a route preview is loading, regardless of whether previous route data exists.

### Scope

- **1 file changed, 1 line modified** - minimal, focused fix
- No other files or logic affected

