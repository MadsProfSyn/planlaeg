

## Fix: Slow UI After "Send til WorkFeed"

### Problem

After clicking "Send X ny til WorkFeed", the user waits ~1 minute because the code sequentially:
1. Calls `send-manual-shifts-to-workfeed` edge function (the actual send)
2. Inserts shifts locally into `supabase_shifts`
3. Awaits `invalidateQueries` for 3 query keys
4. **Calls `sync-workfeed-shifts` edge function** (another ~30-60s round-trip)
5. Awaits another `invalidateQueries`

Steps 4-5 are the bottleneck --- they re-sync from WorkFeed just to show the shifts as "B" (booked) items, but we already have all the data locally from step 1.

### Fix

In `src/pages/PlanlaegSyn.tsx`, restructure `handleSendToWorkfeed` (lines ~504-587):

1. **Keep steps 1-2 unchanged** --- send to WorkFeed, insert shifts locally.
2. **Clear state and invalidate queries immediately** (step 3) --- this already makes the sent inspections disappear from "new" and appear as existing/booked.
3. **Fire the `sync-workfeed-shifts` call in the background** (fire-and-forget) --- don't `await` it. When it completes, silently invalidate the inspector query to refresh shift details. If it fails, show a subtle warning toast.
4. **Set `isSending = false` right after step 2**, not after the sync completes.

### Code Change

```typescript
// After successful send + local insert...

// Clear state immediately
setNewAssignments(new Map());
setScheduledTimes(new Map());
setSelectedInspectionIds([]);
setIsSending(false); // UI unlocks here

// Refresh queries (fast, local)
queryClient.invalidateQueries({ queryKey: ["planlaeg-inspections"] });
queryClient.invalidateQueries({ queryKey: ["existing-scheduled-inspections"] });
queryClient.invalidateQueries({ queryKey: ["planlaeg-inspectors"] });

// Background sync - fire and forget
supabase.functions.invoke("sync-workfeed-shifts", {
  body: { startDate: selectedDate, endDate: selectedDate },
}).then(() => {
  queryClient.invalidateQueries({ queryKey: ["planlaeg-inspectors"] });
}).catch((syncError) => {
  console.warn("Background sync failed:", syncError);
  toast.warning("Vagter sendt, men baggrundssynkronisering fejlede. Opdateres automatisk.");
});
```

### What Changes
- **1 file**: `src/pages/PlanlaegSyn.tsx` --- only the `handleSendToWorkfeed` function
- **No changes** to edge functions, route calculation, or WorkFeed/Monday integration
- UI unlocks in ~2-5 seconds instead of ~60 seconds
- Background sync still runs to ensure full consistency

