

## Problem

After clicking "Sync vagter", the `handleSyncShifts` function only invalidates the `existing-scheduled-inspections` query (line 444). However, the booked shifts (marked "B") shown under each inspector come from the `planlaeg-inspectors` query, which calls `fetch-available-inspectors`. This query is **not** invalidated after sync completes, so the UI keeps showing stale shift data until a full page refresh.

## Fix

**File:** `src/pages/PlanlaegSyn.tsx`

In the `handleSyncShifts` function (~line 444), add invalidation of the `planlaeg-inspectors` query after the sync succeeds:

```typescript
// Current (line 444):
queryClient.invalidateQueries({ queryKey: ["existing-scheduled-inspections", selectedDate] });

// Add:
queryClient.invalidateQueries({ queryKey: ["planlaeg-inspectors"] });
```

This is a single-line addition. No other files or logic changes needed.

