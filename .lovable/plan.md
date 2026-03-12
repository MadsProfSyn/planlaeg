

## Add "Ingen syn" Filter to Inspectors Panel

### What it does
Adds a toggle filter in the right-side "Tilgængelige konsulenter" panel header. When enabled, it hides inspectors who already have booked shifts (`scheduled_shifts > 0`) or existing assignments, showing only inspectors with zero current inspections.

### Implementation

**File: `src/components/planlaeg-syn/InspectorsPanel.tsx`**

1. Add a `showOnlyNoInspections` boolean state (default `false`).

2. Add a toggle button/checkbox labeled "Ingen syn" in the card header, between the title and search input.

3. Extend the `filteredInspectors` memo to also filter by this state:
   - When enabled, only include inspectors where `inspector.scheduled_shifts` is 0 (or undefined) AND the inspector has no items in `existingAssignments`.

```typescript
const filteredInspectors = useMemo(() => {
  let result = inspectors;
  
  if (showOnlyNoInspections) {
    result = result.filter((inspector) => {
      const bookedShifts = inspector.scheduled_shifts || 0;
      const existingItems = (existingAssignments.get(inspector.inspector_uuid) || []).length;
      return bookedShifts === 0 && existingItems === 0;
    });
  }
  
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    result = result.filter((i) => i.navn.toLowerCase().includes(query));
  }
  
  return result;
}, [inspectors, searchQuery, showOnlyNoInspections, existingAssignments]);
```

4. UI: A small toggle button using the existing `Button` component with `variant="outline"` and a size of `"sm"`, styled to look active when toggled on (e.g., `bg-primary text-primary-foreground`).

### Changes
- **1 file**: `src/components/planlaeg-syn/InspectorsPanel.tsx` — add state, filter logic, and toggle UI.

