

## Fix: True Optimistic UI for "Send til WorkFeed"

### Problem

The previous fix only moved `sync-workfeed-shifts` to background. But the real bottleneck is `send-manual-shifts-to-workfeed` itself (line 508), which takes 30-60 seconds because it POSTs to WorkFeed API and chains to Monday sync. The UI stays locked with the spinner the entire time.

### Approach

Convert the entire send flow to optimistic: immediately move the assigned inspections from "new" to "pending/sent" visual state, unlock the UI, and run the edge function in the background.

### Implementation

**File:** `src/pages/PlanlaegSyn.tsx`

1. **Add a `pendingSentAssignments` state** — a `Map<string, MondayItem[]>` that holds items the user just sent, displayed identically to existing "B" items (non-removable).

2. **Merge `pendingSentAssignments` into `existingAssignments`** in the `combinedAssignments` memo, so they immediately appear as booked items on the inspector cards.

3. **Restructure `handleSendToWorkfeed`:**
   - Before calling the edge function: move items from `newAssignments` into `pendingSentAssignments`
   - Clear `newAssignments`, `scheduledTimes`, `selectedInspectionIds`
   - Set `isSending = false` — UI unlocks instantly
   - Show a toast: "Sender X inspektioner til WorkFeed..."
   - Fire `send-manual-shifts-to-workfeed` as a background (non-awaited) promise
   - On success: clear `pendingSentAssignments`, insert shifts locally, invalidate queries, show success toast
   - On failure: move items back from `pendingSentAssignments` to `newAssignments`, show error toast

4. **Update `existingAssignments` memo** to include `pendingSentAssignments` so items render as "B"-style items immediately.

5. **Update `handleRemoveAssignment`** to also block removal of pending items (same as existing).

### What Changes
- **1 file**: `src/pages/PlanlaegSyn.tsx`
- No edge function changes
- No route calculation changes
- No changes to what data is sent to WorkFeed/Monday
- UI unlocks instantly; items visually transition from "new" to "booked" immediately

