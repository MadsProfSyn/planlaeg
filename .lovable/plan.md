

## Fix stale state bugs in cancel + re-drag cycle

Two surgical fixes, no new files.

### Bug 1 — Clean up stale state on removal (`src/pages/PlanlaegSyn.tsx`)

In `handleRemoveAssignment` (line 493-501), after the `setNewAssignments` call, add cleanup for `scheduledTimes` and `manualTimeOverrides`:

```ts
setScheduledTimes((prev) => {
  const next = new Map(prev);
  next.delete(inspectionId);
  return next;
});

setManualTimeOverrides((prev) => {
  const next = new Set(prev);
  next.delete(inspectionId);
  return next;
});
```

### Bug 2 — Reset manualOrder on fresh Railway data (`src/components/planlaeg-syn/InspectorsPanel.tsx`)

In `DroppableInspector`, add a `useEffect` after the `manualOrder` state declaration (line 335):

```ts
useEffect(() => {
  setManualOrder(null);
}, [routeData]);
```

This resets the drag order whenever Railway returns a new route for that inspector.

### No other changes needed.

