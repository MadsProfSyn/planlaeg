

## Fix: WorkFeed Times Are +1 Hour Off

### Problem

When sending shifts to WorkFeed, the times arrive 1 hour too late. For example, a shift starting at 09:00 Copenhagen time shows as 10:00 in WorkFeed.

### Root Cause

The `convertToUTC` function in `send-manual-shifts-to-workfeed/index.ts` (line 298-304) **hardcodes** the Copenhagen offset as `+01:00` (winter time):

```typescript
const localDateTime = `${dateStr}T${timeStr}:00+01:00`;
```

Denmark is currently in **summer time (CEST, UTC+2)**, so the correct offset should be `+02:00`. With `+01:00`, the function calculates a UTC time that is 1 hour too early, which WorkFeed then displays as 1 hour too late when it renders it back in Copenhagen time.

The same hardcoded offset exists in `post-to-workfeed/index.ts` (line ~218).

The Monday.com integration works correctly because it uses the `localTimeToUTC` function which dynamically detects DST via `Intl.DateTimeFormat`.

### Fix

**File 1:** `supabase/functions/send-manual-shifts-to-workfeed/index.ts`

Replace the `convertToUTC` function with proper DST-aware conversion using `Intl.DateTimeFormat` (same approach as the working `localTimeToUTC` function already in the file):

```typescript
function convertToUTC(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const timeParts = timeStr.split(":");
  const hours = parseInt(timeParts[0], 10);
  const minutes = parseInt(timeParts[1], 10);

  // Detect DST offset for Copenhagen on this date
  const testDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Copenhagen",
    timeZoneName: "shortOffset",
  });
  const parts = formatter.formatToParts(testDate);
  const offsetPart = parts.find((p) => p.type === "timeZoneName")?.value || "GMT+1";
  const offsetMatch = offsetPart.match(/GMT([+-])(\d+)/);
  let offsetHours = 1;
  if (offsetMatch) {
    offsetHours = (offsetMatch[1] === "+" ? 1 : -1) * parseInt(offsetMatch[2], 10);
  }

  // Build UTC date by subtracting offset
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours - offsetHours, minutes, 0));
  return utcDate.toISOString();
}
```

**File 2:** `supabase/functions/post-to-workfeed/index.ts`

Replace the hardcoded `+01:00` offset (lines ~217-218) with the same DST-aware approach for `startUTC` and `endUTC`.

### Scope

- 2 edge functions updated with DST-aware timezone conversion
- No frontend changes needed
- No database changes needed

