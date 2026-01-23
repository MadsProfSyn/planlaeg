

## Show Total Inspectors Count & Add Manual Sync Button

This plan adds a total inspector count display to the Synskonsulenter page, adds a manual sync button to trigger WorkFeed synchronization, and updates the sync logic to also deactivate inspectors that have been deleted/archived in WorkFeed.

### Changes Overview

1. **Update Inspectors Page UI** - Add total count display and manual sync button
2. **Enhance Sync Edge Function** - Add logic to deactivate inspectors deleted in WorkFeed

---

### 1. Update Inspectors Page (`src/pages/Inspectors.tsx`)

Add a header section with:
- **Total count display**: Shows "144 synskonsulenter" dynamically
- **Manual sync button**: "Synkroniser fra WorkFeed" with loading state

```text
┌─────────────────────────────────────────────────────────────┐
│  Synskonsulenter                                            │
│  144 aktive synskonsulenter                                 │
│                                                             │
│  [🔄 Synkroniser fra WorkFeed]                              │
└─────────────────────────────────────────────────────────────┘
```

**UI Changes:**
- Add `Users` icon from lucide-react for count display
- Add `RefreshCw` icon for sync button
- Add loading spinner during sync
- Show toast notifications for sync results (created, deactivated counts)
- Add state for `isSyncing` to manage button loading state
- The sync button will invoke `supabase.functions.invoke("sync-workfeed-inspectors")`

---

### 2. Update Edge Function (`supabase/functions/sync-workfeed-inspectors/index.ts`)

Enhance the sync logic to handle deleted/archived employees:

**Current behavior:**
- Creates new inspectors from WorkFeed
- Skips inactive/deleted employees

**New behavior (additions):**
- After processing new employees, check for inspectors in Supabase whose `wf_employee_id` is NOT in the active WorkFeed employee list
- Set `is_active = false` for these inspectors (soft delete)
- Report count of deactivated inspectors in the response

**Updated SyncResult interface:**
```typescript
interface SyncResult {
  // ... existing fields ...
  inspectors_deactivated: number;
  deactivated: Array<{ name: string; email: string | null }>;
}
```

**New sync step (after creating new inspectors):**
```text
Step 5: Deactivate inspectors deleted from WorkFeed
  - Get all active inspectors with wf_employee_id
  - Compare against active WorkFeed employee IDs
  - If inspector's wf_employee_id NOT in active list → set is_active = false
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Inspectors.tsx` | Add total count display, sync button with loading state, sync function |
| `supabase/functions/sync-workfeed-inspectors/index.ts` | Add deactivation logic for deleted/archived employees |

---

### Technical Details

**Inspectors.tsx additions:**
```typescript
// New imports
import { RefreshCw, Users } from "lucide-react";

// New state
const [isSyncing, setIsSyncing] = useState(false);

// New function
const handleSync = async () => {
  setIsSyncing(true);
  try {
    const { data, error } = await supabase.functions.invoke("sync-workfeed-inspectors");
    if (error) throw error;
    
    toast({
      title: "Synkronisering fuldført",
      description: `${data.new_inspectors_created} oprettet, ${data.inspectors_deactivated} deaktiveret`
    });
    
    queryClient.invalidateQueries({ queryKey: ["inspectors"] });
  } catch (error) {
    toast({ title: "Fejl", description: "Synkronisering fejlede", variant: "destructive" });
  } finally {
    setIsSyncing(false);
  }
};
```

**Edge function deactivation logic:**
```typescript
// Step 5: Deactivate inspectors no longer in WorkFeed
const activeWfIds = new Set(employees.map(emp => emp.id));
const { data: activeInspectors } = await supabase
  .from('inspectors')
  .select('id, full_name, email, wf_employee_id')
  .eq('is_active', true)
  .not('wf_employee_id', 'is', null);

for (const inspector of activeInspectors || []) {
  if (!activeWfIds.has(inspector.wf_employee_id)) {
    // Deactivate - no longer in WorkFeed
    await supabase
      .from('inspectors')
      .update({ is_active: false })
      .eq('id', inspector.id);
    
    result.inspectors_deactivated++;
    result.deactivated.push({ name: inspector.full_name, email: inspector.email });
  }
}
```

---

### Safety Notes

- **Daily cron still runs at 6:00 AM** - no changes to automatic scheduling
- **Soft delete only** - inspectors are marked `is_active = false`, not permanently deleted
- **Only affects inspectors with `wf_employee_id`** - manually created inspectors without a WorkFeed link are not affected
- **Idempotent** - running sync multiple times is safe

