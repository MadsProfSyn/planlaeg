

## Inspector Notes System

The `inspectors` table already has a `notes` TEXT column — no database migration needed.

### Changes

**1. `/inspectors` page — show notes and edit them (`src/pages/Inspectors.tsx`)**

- Add `notes` to the `InspectorWithDetails` interface and the Supabase select query
- Add a 📝 icon next to the inspector name when `notes` is non-empty, with a Tooltip showing the note text on hover
- Pass `notes` to `EditInspectorDialog` via the `editingInspector` state object

**2. Edit dialog — add notes textarea (`src/components/inspectors/EditInspectorDialog.tsx`)**

- Add `notes` to the `inspector` prop interface and to `formData` state
- Add a `Textarea` field labeled "Noter" in the form, between the department select and skills checkboxes
- Include `notes` in the Supabase `.update()` call on save

**3. Route planning — show notes in InspectorsPanel (`src/components/planlaeg-syn/InspectorsPanel.tsx`)**

- Add `notes?: string | null` to the `Inspector` interface in `PlanlaegSyn.tsx`
- In the `fetch-available-inspectors` response mapping (PlanlaegSyn.tsx), carry over inspector notes from the response
- In `DroppableInspector`, when the inspector has notes, show a 📝 icon next to their name with a Tooltip/Popover displaying the note text — same pattern as the custom time Info icon already there

**4. Fetch available inspectors edge function (`supabase/functions/fetch-available-inspectors/index.ts`)**

- Include `notes` from the `inspectors` table in the query that fetches inspector details, so it's available in the response

### Files modified

| File | Change |
|------|--------|
| `src/pages/Inspectors.tsx` | Add `notes` to interface, query, table row (icon + tooltip), and edit handler |
| `src/components/inspectors/EditInspectorDialog.tsx` | Add `notes` to props, form state, form UI (Textarea), and save mutation |
| `src/pages/PlanlaegSyn.tsx` | Add `notes` to Inspector interface and response mapping |
| `src/components/planlaeg-syn/InspectorsPanel.tsx` | Show 📝 icon + Tooltip on inspector card when notes exist |
| `supabase/functions/fetch-available-inspectors/index.ts` | Include `notes` in inspector details query |

