

## Frontend updates to match Railway VRP backend changes

### 1. Cylinderskift now applies to FF

**File: `src/lib/inspection-duration.ts` (line 28)**
Update the `FALLBACK_MODIFIERS` to include "FF" in Cylinderskift's `applies_to` array:
```
Cylinderskift: { minutes: 10, applies_to: ["FF", "IF", "PS"] },
```

**Database**: Update the `inspection_duration_modifiers` row for "Cylinderskift" to set `applies_to = '{FF,IF,PS}'`. This requires a migration.

**File: `src/pages/admin/SynVariabler.tsx` (line 203)**
The "applies to" display already reads from the DB, so it will update automatically after the migration. Optionally, make `applies_to` editable so admins can change this in the future (stretch goal, not critical now).

### 2. Manual duration override — already done

The `EditMondayItemDialog` (used in /alle-syn) already has a `duration_minutes` field with auto-placeholder, saves NULL when empty. The `getEffectiveDuration()` function in `inspection-duration.ts` already handles this. No changes needed for the edit UI.

However, there is no "Manuel" badge shown anywhere when `duration_minutes` is set. Add a small visual indicator:

**File: `src/components/planlaeg-syn/InspectorsPanel.tsx` (~line 354-357)**
After the room count display, if the item has `duration_minutes` set, show a small "Manuel" badge in italic muted style.

**File: `src/components/alle-syn/AlleSynTable.tsx`**
In the duration column, if `duration_minutes` is set (non-null), show a small "Manuel" indicator next to the value.

### 3. Display note on /planlaeg-syn route stops

**File: `src/types/route-optimizer.ts` (line 22-30)**
Add `note?: string` to the `RouteStop` interface.

**File: `src/components/planlaeg-syn/InspectorsPanel.tsx` (~line 345-350)**
Below the address display in each assigned inspection row, if the item's `note` field (from `MondayItem`) is non-empty, render it in a smaller muted text. Also check `routeStop.note` from the API response.

Additionally, show the note from the route API response if available (Railway now returns it). Below the address line:
```tsx
{(item.note || routeStop?.note) && (
  <p className="text-[10px] text-muted-foreground italic truncate max-w-[200px]">
    {item.note || routeStop?.note}
  </p>
)}
```

### Summary of changes

| File | Change |
|------|--------|
| `src/lib/inspection-duration.ts` | Add "FF" to Cylinderskift fallback `applies_to` |
| Migration SQL | Update `inspection_duration_modifiers` Cylinderskift row |
| `src/types/route-optimizer.ts` | Add `note?: string` to `RouteStop` |
| `src/components/planlaeg-syn/InspectorsPanel.tsx` | Show note below address; show "Manuel" badge when `duration_minutes` set |
| `src/components/alle-syn/AlleSynTable.tsx` | Show "Manuel" indicator in duration column |

No new tables or columns needed.

