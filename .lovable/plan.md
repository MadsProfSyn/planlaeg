

## Respect manual duration overrides from /alle-syn in /planlaeg-syn

### Problem
When a user manually sets `duration_minutes` on an inspection via /alle-syn, the /planlaeg-syn page ignores it — `calculateInspectionDuration()` always recalculates from type/rooms/DYMO. The manual override stored in `monday_items_selected.duration_minutes` is never checked.

### Solution
Create a helper function that checks `item.duration_minutes` first, falling back to `calculateInspectionDuration()` only when null. Use it in the 3 places that calculate duration in /planlaeg-syn.

### Changes

**1. `src/lib/inspection-duration.ts`** — Add a new helper:
```typescript
export function getEffectiveDuration(item: { duration_minutes?: number | null; synstype: string | null; antal_vaerelser: number | null; raw?: any }): number {
  if (item.duration_minutes != null) return item.duration_minutes;
  return calculateInspectionDuration({ synstype: item.synstype, antalVaerelser: item.antal_vaerelser, raw: item.raw });
}
```

**2. `src/components/planlaeg-syn/ScheduleTimesDialog.tsx`** (~line 110)
- Replace `calculateInspectionDuration({...})` with `getEffectiveDuration(inspection)`

**3. `src/components/planlaeg-syn/InlineTimeEditor.tsx`** (~line 74)
- Replace `calculateInspectionDuration({...})` with `getEffectiveDuration(inspection)`

**4. `src/components/alle-syn/AlleSynTable.tsx`** (~line 36)
- Update `getDisplayDuration` to also use `getEffectiveDuration` for consistency

Three files updated, one function added. No database changes.

