

## Make availability save instant with background processing

### Problem
When saving time ranges, the flow is: `TimeRangeManager.handleSave` → awaits `onSave(ranges)` → which awaits `handleSaveTimeRanges` → which awaits the RPC call → then awaits `fetchConsultants()` to refetch all data. The dialog stays open blocking the user for ~30 seconds.

### Solution
Make the save feel instant by closing the dialog immediately with an optimistic UI update, then running the RPC and refetch in the background.

### Changes

**File: `src/components/availability/ManageAvailabilityDrawer.tsx` (~lines 103-136)**
- Change `handleSaveTimeRanges` to:
  1. Immediately close the dialog (don't await — return resolved promise so `TimeRangeManager` closes)
  2. Apply optimistic UI update to the consultant's status and time ranges in local state
  3. Show a "Gemmer..." toast
  4. Fire the RPC call in the background (no await in the caller)
  5. On success: show success toast, call `onSuccess`, silently refetch
  6. On failure: show error toast, revert optimistic update by refetching

**File: `src/components/availability/TimeRangeManager.tsx`**
- No changes needed — it already calls `onSave` and closes on resolved promise. Since we'll make `handleSaveTimeRanges` return immediately (not throw), the dialog will close instantly.

### Technical detail
```
// Pseudocode for new handleSaveTimeRanges:
const handleSaveTimeRanges = async (ranges) => {
  const consultant = timeRangeDialog.consultant;
  
  // 1. Optimistic update
  setConsultants(prev => prev.map(c => 
    c.inspector_id === consultant.inspector_id 
      ? { ...c, availability_status: "available", source: "override", time_ranges: ranges }
      : c
  ));
  
  // 2. Close dialog immediately (don't throw from here)
  // The returned promise resolves, so TimeRangeManager closes
  
  // 3. Background save
  const toastId = toast.loading("Gemmer tidsrum...");
  supabase.rpc("set_consultant_availability_with_ranges", {...})
    .then(({ error }) => {
      if (error) throw error;
      toast.success("Tidsrum opdateret", { id: toastId });
      onSuccess?.();
      fetchConsultants(); // silent refresh
    })
    .catch(err => {
      toast.error("Kunne ikke gemme tidsrum", { id: toastId });
      fetchConsultants(); // revert
    });
};
```

One file changed. No database or edge function changes needed.

