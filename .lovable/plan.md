

## Auto-refresh /planlaeg-syn when new inspections arrive

### Problem
The inspections list on `/planlaeg-syn` only updates on page load or when filters change. When a new item is inserted into `monday_items_selected` (from Monday.com), the user must manually refresh.

### Solution
Subscribe to Supabase Realtime on the `monday_items_selected` table for INSERT events. When a new row arrives, invalidate the relevant React Query caches so the UI refreshes automatically.

### Change

**File: `src/pages/PlanlaegSyn.tsx`**

Add a `useEffect` that creates a Supabase Realtime channel listening for `INSERT` on `monday_items_selected`. On receiving an event, call `queryClient.invalidateQueries` for both `"planlaeg-inspections"` and `"existing-scheduled-inspections"` keys. Clean up the subscription on unmount.

```typescript
// Inside PlanlaegSyn component, after the query definitions (~line 200)
useEffect(() => {
  const channel = supabase
    .channel("planlaeg-syn-realtime")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "monday_items_selected" },
      () => {
        queryClient.invalidateQueries({ queryKey: ["planlaeg-inspections"] });
        queryClient.invalidateQueries({ queryKey: ["existing-scheduled-inspections"] });
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [queryClient]);
```

One block added to one file. No database or edge function changes needed — the table already has Realtime enabled via public RLS policies.

