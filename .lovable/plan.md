

## Fix: SMS Historik tab not showing data

### Problem
The `SmsHistoryTab` component initializes its date to **today** (`new Date().toISOString().split("T")[0]`). It does not read the `date` URL parameter from the Availability page. So when you navigate to `/availability?date=2026-04-16` and switch to the SMS Historik tab, it queries for today's date which has no SMS logs.

The database confirms SMS logs exist for dates like `2026-04-16` (15 records), `2026-04-01` (7 records), etc. — but none for today (2026-03-23).

### Fix

**File: `src/pages/Availability.tsx`** (line 544)
- Pass the URL `date` parameter (from `filters.date` or `searchParams.get("date")`) to `SmsHistoryTab` as an `initialDate` prop.

**File: `src/components/availability/SmsHistoryTab.tsx`**
- Accept an optional `initialDate` prop
- Use `initialDate` (if provided) instead of today's date as the default for `selectedDate`
- This way, when the user arrives at `/availability?date=2026-04-16` and clicks SMS Historik, it automatically loads SMS logs for that date

### Technical detail
- `SmsHistoryTab` will receive `initialDate?: string`
- Default state: `useState(initialDate || new Date().toISOString().split("T")[0])`
- The reset button will still reset to today's date (current behavior)
- No database or edge function changes needed — the data is already there

