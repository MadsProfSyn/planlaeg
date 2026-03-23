

## Add address search to "Synsopgaver" panel on /planlaeg-syn

### What
Add a search input inside the "Synsopgaver" card header (same pattern as the inspector panel's search) that filters inspections by address. Case-insensitive partial matching against the `adresse` field.

### How

**1 file: `src/components/planlaeg-syn/InspectionsPanel.tsx`**

- Import `useState`, `useMemo` from React, `Search` from lucide-react, and `Input` from UI
- Add `searchQuery` state inside `InspectionsPanel`
- Compute `filteredInspections` using `useMemo`: take `visibleInspections`, filter by `searchQuery` against `inspection.adresse` (case-insensitive `.includes()`)
- Add a search input with search icon in the `CardHeader` (below the title), matching the inspector panel pattern:
  ```
  <div className="relative">
    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    <Input placeholder="Søg adresse..." value={searchQuery} onChange={...} className="pl-9" />
  </div>
  ```
- Replace `visibleInspections` references in the render with `filteredInspections`
- Update the empty state to show "Ingen synsopgaver matcher søgningen" when `searchQuery` is set

