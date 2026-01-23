

## Automatic Inspector Sync from WorkFeed

This feature will automatically sync new employees from WorkFeed to the inspectors table daily, ensuring your inspector list stays up-to-date without manual intervention.

### How It Works

1. **Daily Sync**: A cron job runs once daily (at 6:00 AM) to check for new employees in WorkFeed
2. **Smart Detection**: The system compares WorkFeed employees against existing inspectors using `wf_employee_id`
3. **Auto-Creation**: New employees found in WorkFeed are automatically added to the inspectors table
4. **Department Mapping**: New inspectors are assigned to the correct department based on WorkFeed's department data
5. **No Overwrites**: Existing inspector data (address, phone, skills, etc.) is preserved - only new employees are added

### What Gets Created for New Inspectors

| Field | Source |
|-------|--------|
| `full_name` | WorkFeed employee name |
| `email` | WorkFeed employee email |
| `wf_employee_id` | WorkFeed employee ID |
| `department_id` | Mapped from WorkFeed department |
| `is_active` | Set to `true` |
| `phone` | From WorkFeed (if available) |

---

### Implementation Details

#### 1. New Edge Function: `sync-inspectors-cron`

**Location:** `supabase/functions/sync-inspectors-cron/index.ts`

This function will:
- Call the main sync function `sync-workfeed-inspectors`
- Run via pg_cron daily at 6:00 AM Copenhagen time

```text
┌─────────────────────┐
│   pg_cron (daily)   │
│   6:00 AM CET       │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────────────┐
│  sync-inspectors-cron       │
│  (Edge Function wrapper)    │
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐
│  sync-workfeed-inspectors   │
│  (Main sync logic)          │
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐
│  WorkFeed API               │
│  GET /companies/{id}/       │
│      employees              │
└─────────────────────────────┘
```

#### 2. New Edge Function: `sync-workfeed-inspectors`

**Location:** `supabase/functions/sync-workfeed-inspectors/index.ts`

Main sync logic:
1. Fetch all employees from WorkFeed API (`/companies/{id}/employees`)
2. Fetch existing inspectors from Supabase with their `wf_employee_id`
3. Identify new employees (those not in Supabase)
4. Map WorkFeed department IDs to Supabase department IDs
5. Insert new inspectors with appropriate fields
6. Return summary of what was synced

**Response format:**
```json
{
  "success": true,
  "total_workfeed_employees": 125,
  "existing_inspectors": 118,
  "new_inspectors_created": 7,
  "skipped_no_department": 0,
  "created": [
    { "name": "New Person", "email": "new@example.com", "department": "Storkøbenhavn" }
  ]
}
```

#### 3. Update `supabase/config.toml`

Add configuration for the two new functions:
```toml
[functions.sync-inspectors-cron]
verify_jwt = false

[functions.sync-workfeed-inspectors]
verify_jwt = false
```

#### 4. Database: Add Cron Job

Create a daily cron job to run the sync at 6:00 AM:
```sql
SELECT cron.schedule(
  'sync-inspectors-daily',
  '0 6 * * *',  -- Daily at 6:00 AM
  $$
  SELECT net.http_post(
    url := 'https://wtkyxxfeubpadivllowr.supabase.co/functions/v1/sync-inspectors-cron',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 60000
  );
  $$
);
```

---

### Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/sync-workfeed-inspectors/index.ts` | Main sync logic - fetches from WorkFeed and creates new inspectors |
| `supabase/functions/sync-inspectors-cron/index.ts` | Cron wrapper that calls the main sync function |

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/config.toml` | Add entries for both new functions |

### Database Changes

- Add new pg_cron job via SQL insert (not migration) to run daily at 6:00 AM

---

### Manual Trigger Option

The `sync-workfeed-inspectors` function can also be called manually via API for on-demand syncing:

```bash
POST /functions/v1/sync-workfeed-inspectors
```

This allows you to trigger a sync anytime without waiting for the daily cron job.

---

### Safety Features

1. **No overwrites**: Existing inspector data is never modified
2. **Active by default**: New inspectors are created with `is_active = true`
3. **Department validation**: Inspectors without a valid department mapping are skipped (logged for review)
4. **Detailed logging**: All sync operations are logged for troubleshooting
5. **Idempotent**: Running the sync multiple times won't create duplicates (checks by `wf_employee_id`)

