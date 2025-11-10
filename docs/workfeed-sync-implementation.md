# WorkFeed Shift Synchronization - Implementation Guide

## Overview
This implementation adds automatic WorkFeed shift synchronization after VRP approval. When users click "Godkend syn" (Approve inspections), the system now:
1. Creates proposed assignments in the database
2. Creates shift records in `supabase_shifts`
3. Automatically POSTs each shift to the WorkFeed API
4. Shows real-time progress during synchronization

## 🔒 TEST MODE Safety Feature

**CRITICAL**: The system includes a `TEST_MODE` flag to prevent accidentally posting shifts to production inspectors during testing.

### Test Inspectors
When `TEST_MODE = true`, only these inspectors should be used:
- **Albert Bisgaard** - albert@profsyn.dk - `wf_employee_id: tUJvSyc62KzaMth3oFzf`
- **Mads Boye Nielsen** - mads@profsyn.dk - `wf_employee_id: yu4GsjDkxANUl3w5rqgL`
- **Jobson De Souza** - jobson@profsyn.dk - `wf_employee_id: iZOmCAs4BDdhxLdHDHq9`

These inspectors are marked with `notes LIKE '%TEST USER%'` in the `inspectors` table.

### Enabling/Disabling TEST_MODE
Edit `src/lib/testMode.ts`:
```typescript
export const TEST_MODE = true;  // Set to false for production
```

When TEST_MODE is active:
- ⚠️ A prominent orange warning appears at the top of the Planlægningsmodal
- Only test inspectors appear in VRP results and manual selectors
- All WorkFeed POSTs go only to the 3 test inspectors

## Files Created/Modified

### New Files
1. **`supabase/functions/post-to-workfeed/index.ts`**
   - Edge function that POSTs a single shift to WorkFeed API
   - Handles time conversion (Copenhagen → UTC)
   - Maps inspection types to WorkFeed role IDs
   - Updates shift sync status in database

2. **`src/lib/testMode.ts`**
   - Central configuration for TEST_MODE
   - Provides helper functions for test mode filtering

3. **`docs/workfeed-sync-implementation.md`** (this file)
   - Implementation documentation

### Modified Files
1. **`supabase/functions/approve-vrp-assignments/index.ts`**
   - Now creates `supabase_shifts` records after creating assignments
   - Returns `shift_ids` array in response

2. **`src/components/inspections/PlanlaegSynModal.tsx`**
   - Added TEST_MODE warning banner
   - Added sync progress state and UI
   - Calls `post-to-workfeed` for each shift after approval
   - Shows real-time progress bar and counter

3. **`src/types/vrp.ts`**
   - Added `shift_ids?: string[]` to `VrpApprovalResponse`

4. **`supabase/config.toml`**
   - Added `[functions.post-to-workfeed]` configuration

### Database Changes
- Created function: `get_wf_role_id_for_inspection(TEXT)`
  - Maps inspection types to WorkFeed role IDs
  - Example: "Indflytningssyn" → "IF" → WorkFeed role ID

## User Flow

### 1. Select Inspections
User selects Monday items and clicks "Planlæg Syn"

### 2. VRP Calculation
System calculates optimal routes (TEST_MODE filters to test inspectors)

### 3. Review & Adjust
User reviews assignments, can manually override inspectors

### 4. Approval
User clicks "Godkend syn":
- **Phase 1**: "Planlægger..." (creates assignments & shifts)
- **Phase 2**: "Synkroniserer vagt 1 af 5..." (posts to WorkFeed)
  - Progress bar shows: ✅ 3 synkroniseret
  - If failures: ⚠️ 2 fejlede

### 5. Results
- **All successful**: "✅ 5 vagter er oprettet i WorkFeed"
- **Partial failure**: "✅ 3 synkroniseret • ⚠️ 2 fejlede"

## Testing Checklist

### Before Testing
- [ ] `TEST_MODE = true` in `src/lib/testMode.ts`
- [ ] Test inspectors have `notes` containing "TEST USER"
- [ ] Test inspectors have availability in `supabase_availability`
- [ ] Test inspectors have skills in `inspector_skills`

### During Testing
- [ ] Orange TEST_MODE warning appears in modal
- [ ] Only test inspectors appear in VRP results
- [ ] Only test inspectors appear in manual selector
- [ ] Progress bar shows during sync
- [ ] Success count updates in real-time

### Verification
- [ ] Check `supabase_shifts` table: `sync_status = 'synced'`
- [ ] Check `supabase_shifts` table: `wf_shift_id` is populated
- [ ] Open WorkFeed app: shifts appear for test inspectors
- [ ] Failed shifts have `sync_status = 'sync_failed'`
- [ ] Failed shifts have `sync_error` populated

## Production Deployment

### Prerequisites
1. Verify all test scenarios pass
2. Check WorkFeed API connectivity
3. Verify role mappings are complete

### Deployment Steps
1. **Disable TEST_MODE**
   ```typescript
   // src/lib/testMode.ts
   export const TEST_MODE = false;
   ```

2. **Deploy to production**
   - Edge functions deploy automatically
   - Frontend updates on next build

3. **Test with 1 real inspection**
   - Select a single Monday item
   - Complete the full flow
   - Verify shift appears in WorkFeed

4. **Monitor**
   - Watch edge function logs
   - Check sync_status in database
   - Verify shifts appear in WorkFeed

## Error Handling

### Common Errors

**"Role ID not found for type: X"**
- Fix: Add mapping in `inspection_type_mappings` and `role_mappings` tables

**"WorkFeed API error (401)"**
- Fix: Check `WORKFEED_API_KEY` secret is correct

**"WorkFeed API error (404)"**
- Fix: Check `WORKFEED_COMPANY_ID` is correct

**"Inspector not found"**
- Fix: Ensure inspector has `wf_employee_id` populated

### Retry Failed Syncs
Failed shifts can be retried manually:
1. Find shift with `sync_status = 'sync_failed'`
2. Call `post-to-workfeed` edge function with `shiftId`
3. Or fix issue and re-approve the inspection

## Database Schema

### `supabase_shifts` Columns
```sql
sync_status TEXT DEFAULT 'pending'  -- 'pending', 'synced', 'sync_failed'
sync_error TEXT                      -- Error message if failed
sync_attempts INTEGER DEFAULT 0      -- Number of sync attempts
last_sync_attempt TIMESTAMPTZ        -- Last attempt timestamp
wf_shift_id TEXT                     -- WorkFeed shift ID (when synced)
```

## Edge Function Logs

### Viewing Logs
```bash
# View post-to-workfeed logs
supabase functions logs post-to-workfeed --limit 50
```

### Log Messages
- `[post-to-workfeed] Processing shift: {id}`
- `[post-to-workfeed] Role ID: {roleID}`
- `[post-to-workfeed] POSTing to WorkFeed: {payload}`
- `[post-to-workfeed] ✅ Successfully synced shift`
- `[post-to-workfeed] ❌ Error: {message}`

## Troubleshooting

### No shifts created after approval
- Check edge function logs for `approve-vrp-assignments`
- Verify inspectors have `wf_employee_id`

### Sync fails with "Role ID not found"
- Run: `SELECT * FROM inspection_type_mappings`
- Run: `SELECT * FROM role_mappings`
- Add missing mappings

### Progress stuck at "Synkroniserer..."
- Check browser console for errors
- Check `post-to-workfeed` edge function logs
- Verify network connectivity

### WorkFeed shows different time
- Check timezone conversion in `post-to-workfeed`
- Times should be UTC in WorkFeed API
- Currently assumes Copenhagen = UTC+1

## API Reference

### `post-to-workfeed` Edge Function

**Input:**
```json
{
  "shiftId": "uuid-here"
}
```

**Output (Success):**
```json
{
  "success": true,
  "wf_shift_id": "workfeed-id",
  "shift_id": "uuid-here"
}
```

**Output (Error):**
```json
{
  "success": false,
  "error": "Error message"
}
```

### WorkFeed API Endpoint

**POST** `https://europe-west1-production-eu-327a3.cloudfunctions.net/api/companies/{COMPANY_ID}/shifts`

**Headers:**
```
Authorization: {WORKFEED_API_KEY}
Content-Type: application/json
```

**Body:**
```json
{
  "roleID": "wf_role_id",
  "start": "2025-11-15T08:00:00.000Z",
  "end": "2025-11-15T16:00:00.000Z",
  "employeeID": "wf_employee_id",
  "released": true,
  "comment": "Address of inspection"
}
```

## Security Considerations

1. **WorkFeed API Key**: Stored as Supabase secret, never exposed to client
2. **Service Role Key**: Edge function uses service role for database access
3. **TEST_MODE**: Prevents accidental production data modification
4. **Error Logging**: Errors logged to database, not exposed to client
5. **Rate Limiting**: Consider adding if WorkFeed API has rate limits

## Future Improvements

1. **Batch API Calls**: POST multiple shifts in one API call if WorkFeed supports it
2. **Automatic Retry**: Add automatic retry for failed syncs with exponential backoff
3. **Sync Dashboard**: Admin page to view and retry failed syncs
4. **Timezone Handling**: Use `date-fns-tz` for proper timezone conversion
5. **Optimistic UI**: Show shifts as "pending sync" immediately after approval
6. **WebSocket Updates**: Real-time sync status updates without polling
