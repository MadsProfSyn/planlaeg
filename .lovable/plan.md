

## Show Inspector Notes as Orange Text Instead of Tooltip

### Change

In `src/components/planlaeg-syn/InspectorsPanel.tsx` (lines 506-515), replace the StickyNote icon + Tooltip with inline orange text displayed to the right of the `(!)` availability icon.

**Current** (lines 506-515): StickyNote icon with hover tooltip showing notes.

**New**: Remove the StickyNote/Tooltip block. After the `hasCustomTime` Info icon block (line 525), add the notes as orange text:

```tsx
{inspector.notes && (
  <span className="text-xs text-orange-500 truncate max-w-[150px]" title={inspector.notes}>
    {inspector.notes}
  </span>
)}
```

This places the note text on the same line, same height, right after the `(!)` icon — as orange text with truncation and a native title tooltip for overflow.

### Files modified

| File | Change |
|------|--------|
| `src/components/planlaeg-syn/InspectorsPanel.tsx` | Replace StickyNote icon+Tooltip with inline orange text after the Info icon |

