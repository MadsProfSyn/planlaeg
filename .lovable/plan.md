

## Fix: Send edited note to WorkFeed

### Problem
`buildWorkfeedComment()` in `send-manual-shifts-to-workfeed/index.ts` only reads `item.raw.Note` (original Monday JSON). When a user edits the note via /alle-syn, it's saved to `item.note` (dedicated column), which is never checked.

### Fix

**File: `supabase/functions/send-manual-shifts-to-workfeed/index.ts` — `buildWorkfeedComment` (~line 262-293)**

Change the note source to prefer `item.note` (user-edited) over `item.raw.Note` (original):

```typescript
function buildWorkfeedComment(item: any): string {
  const parts: string[] = [];

  // 1. Address
  if (item.adresse) {
    parts.push(item.adresse);
    parts.push("");
  }

  // 2. Notes — prefer user-edited note column, fall back to raw.Note
  const raw = item.raw || {};
  const noteText = item.note || raw.Note || "";
  if (noteText) {
    let note = noteText;
    if (note.toUpperCase().includes("DYMO") && raw.Lejersnavn) {
      note = note.replace('" "', `"${raw.Lejersnavn}"`);
    }
    parts.push(note);
    parts.push("");
  }

  // 3. OBS if present
  if (raw.OBS && raw.OBS.trim() !== "") {
    parts.push(`OBS: ${raw.OBS.trim()}`);
  }

  // Remove trailing empty lines
  while (parts.length > 0 && parts[parts.length - 1] === "") {
    parts.pop();
  }

  return parts.join("\n");
}
```

One function changed in one file. The same pattern should also be applied to `post-to-workfeed/index.ts` `buildWorkfeedComment` for consistency, though that function uses `inspection.notes` from `inspection_queue` (different flow).

