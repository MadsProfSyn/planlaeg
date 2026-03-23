

## Fix frontend duration to use `has_dymo` / `has_cylinderskift` flags

### Problem
`calculateInspectionDuration()` currently parses `raw.Note` for keyword detection. But the DB trigger now sets `has_dymo` and `has_cylinderskift` from both `note` and `raw->>'Note'`. The frontend ignores these boolean flags, so editing `note` in the UI doesn't update the displayed duration.

### Solution
Update `calculateInspectionDuration()` to accept and use the boolean flags instead of parsing `raw.Note`. This aligns the frontend with the DB trigger logic.

### Changes

**`src/lib/inspection-duration.ts`**
- Add `has_dymo` and `has_cylinderskift` to `DurationParams` interface (optional booleans)
- Replace the raw.Note parsing block with simple boolean checks:
  - If `has_dymo` is true and DYMO modifier applies to the type, add minutes
  - If `has_cylinderskift` is true and Cylinderskift modifier applies to the type, add minutes
  - Fall back to raw.Note parsing only if the booleans are not provided (backward compat)
- Update `getEffectiveDuration()` signature to pass `has_dymo` and `has_cylinderskift` through

**`src/components/alle-syn/AlleSynTable.tsx`**
- `getDisplayDuration()` already calls `getEffectiveDuration(item)` — no change needed since item already has `has_dymo`/`has_cylinderskift` from the DB query

**`src/components/alle-syn/EditMondayItemDialog.tsx`**
- The `autoDuration` calculation needs to pass `has_dymo`/`has_cylinderskift` from the item

**`src/components/planlaeg-syn/InlineTimeEditor.tsx` and `ScheduleTimesDialog.tsx`**
- Already call `getEffectiveDuration(inspection)` — will work automatically once the signature accepts the flags

### Technical detail
The key change in `calculateInspectionDuration`:
```typescript
// Before: parses raw.Note
// After: uses boolean flags, falls back to raw.Note parsing
const hasDymo = params.has_dymo ?? (note.toUpperCase().includes("DYMO"));
const hasCyl = params.has_cylinderskift ?? (note.toUpperCase().includes("CYLINDERSKIFT") || note.toUpperCase().includes("CYLINDER"));
```

This ensures backward compatibility while preferring the DB-computed flags.

