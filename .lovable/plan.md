## Plan

Change the existing `Sync vagter` button on `/planlaeg-syn` to `Sync data` and have it run both sync operations in parallel for the selected date.

## Changes

- `src/pages/PlanlaegSyn.tsx`
  - Rename button label `Sync vagter` → `Sync data` (keep the same icon and loading spinner, update the `title` tooltip accordingly).
  - Update `handleSyncShifts` (rename to `handleSyncData`) to run in parallel:
    - `supabase.functions.invoke("sync-workfeed-shifts", { body: { startDate: selectedDate, endDate: selectedDate } })`
    - `fetch(workfeed-ingest-availability?from=<selectedDate ISO start>&to=<selectedDate ISO end>, POST, Bearer <session token>)` — same call pattern already used on `/availability`.
  - Use `Promise.allSettled` so a failure in one doesn't block the other; show a single toast summarising `Synkroniseret X vagter og Y tilgængelighedsposter` (or a partial error toast if one side fails).
  - After completion, invalidate: `existing-scheduled-inspections`, `planlaeg-inspectors`.
  - Reuse the existing `isSyncing` state — no new button, no new state.

## Out of scope

- No changes to Edge Functions, DB schema, `/availability` page, normalizer, or geocoding.