

## Fix: Note not displaying after edit on /alle-syn

### Problem
The `AlleSynTable` extracts the note from `item.raw?.Note` (the original Monday.com JSON), but the `EditMondayItemDialog` saves edits to the `note` column on the table. The display function never checks the `note` column, so edited notes appear as "—".

### Fix

**File: `src/components/alle-syn/AlleSynTable.tsx` — `extractNote` function (~line 23-28)**

Change the logic to prefer the `note` column (user-edited value) and fall back to `raw.Note` (original Monday data):

```typescript
function extractNote(item: MondayItem): string {
  // Prefer the dedicated note column (user edits), fall back to raw.Note
  if ((item as any).note) return (item as any).note;
  if (!item.raw) return "";
  const data = typeof item.raw === "string" ? JSON.parse(item.raw) : item.raw;
  return data?.Note || "";
}
```

Update the call site (~line 93) to pass `item` instead of `item.raw`.

One function changed in one file.

