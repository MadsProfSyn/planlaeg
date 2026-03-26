

## Fix: Re-protect fixed_order times from stale auto-apply

### Problem
The fixed_order Railway response applies correct times via `onAutoScheduledTimes(freshTimes, itemIds)`, but clearing `manualTimeOverrides` triggers a re-render causing the `useEffect` watching `routeData` to re-apply the old (non-fixed-order) times — overwriting the fresh ones.

### Fix — one change in `callRailwayReorder` (InspectorsPanel.tsx)

After applying fresh times with `onAutoScheduledTimes`, immediately call `onUpdateScheduledTimes(freshTimes)` to re-add those IDs to `manualTimeOverrides`, protecting them from the stale auto-apply.

**Lines ~425-430**, change from:
```ts
// Clear manual overrides first so fresh times are not blocked
onClearManualOverrides?.(itemIds);
// Apply fresh Railway times with forceIds to bypass stale closure
if (freshTimes.size > 0) {
  onAutoScheduledTimes(freshTimes, itemIds);
}
```

To:
```ts
// Clear manual overrides first so fresh times are not blocked
onClearManualOverrides?.(itemIds);
// Apply fresh Railway times with forceIds to bypass stale closure
if (freshTimes.size > 0) {
  onAutoScheduledTimes(freshTimes, itemIds);
  // Re-protect these IDs so the stale routeData auto-apply cannot overwrite them
  onUpdateScheduledTimes(freshTimes);
}
```

`onUpdateScheduledTimes` (which is `handleUserScheduledTimes` in PlanlaegSyn.tsx) writes the times to `scheduledTimes` AND adds all IDs to `manualTimeOverrides` — so the subsequent stale `routeData` useEffect auto-apply will be blocked.

No other changes needed.

