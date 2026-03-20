

## Add End Time Cascade in ScheduleTimesDialog

### Problem
In `src/components/planlaeg-syn/ScheduleTimesDialog.tsx`, `handleStartTimeChange` (line 256) cascades to subsequent inspections, but `handleEndTimeChange` (line 311) only updates the single inspection's end time with no cascade.

### Fix
Update `handleEndTimeChange` to cascade subsequent inspections when `cascadeEnabled` is true — using the edited end time as the new baseline, then applying `travel + duration` for each following inspection (with lunch break support). This is the same loop already used in `handleStartTimeChange` lines 280-304.

### Changes
**1 file:** `src/components/planlaeg-syn/ScheduleTimesDialog.tsx`

Replace `handleEndTimeChange` with a version that, when `cascadeEnabled`, finds the edited inspection's index, then loops through all subsequent inspections recalculating `start = prev_end + travel` and `end = start + duration`, respecting any lunch breaks in between.

