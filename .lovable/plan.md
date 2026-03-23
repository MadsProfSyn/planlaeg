

## Add delete button to Alle Syn table

### Overview
Add a delete action next to the existing edit (pencil) button on each row, with a confirmation dialog to prevent accidental deletions.

### Changes

**1. `src/components/alle-syn/AlleSynTable.tsx`**
- Add `onDelete: (id: number) => void` to props interface
- Import `Trash2` icon from lucide-react
- Add a delete button next to the edit button in the last column
- Style with `hover:bg-destructive/10` and red icon, matching the pattern in `MondayItemsTable.tsx`

**2. `src/pages/AlleSyn.tsx`**
- Add state for delete confirmation dialog (`deleteId`, `deleteOpen`)
- Add `handleDelete` function that calls `supabase.from("monday_items_selected").delete().eq("id", id)`
- Show success/error toast
- Re-fetch items after deletion
- Add an `AlertDialog` for confirmation ("Er du sikker?" / "Slet" / "Annuller")
- Pass `onDelete` to `AlleSynTable`

### No database changes needed
The `monday_items_selected` table already has a public DELETE RLS policy.

