

## Extend availability sync window from 45 to 60 days

### Files to update

**1. `supabase/functions/sync-availability-cron/index.ts`**
- Change `today.getDate() + 45` → `today.getDate() + 60`
- Update variable name and comment

**2. `supabase/functions/sync-shifts-cron/index.ts`**
- Change `today.getDate() + 45` → `today.getDate() + 60`
- Update variable name and comment

**3. `supabase/functions/sync-workfeed-shifts/index.ts`**
- Already uses 90 days as default — no change needed

That's it. Only the two cron functions still reference 45 days.

