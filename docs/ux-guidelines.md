# UX Guidelines

## Navigation Structure

### Primary Navigation
- **Start with `/inspections`** (Page 1) - Main inspection listing and management
- **Later add `/vrp`** (Page 2) - Optimizer results and VRP suggestions
- **Future**: `/dashboard`, `/reports`, `/settings`

### Navigation Principles
- Keep navigation minimal and task-focused
- Use breadcrumbs for deeper navigation levels
- Maintain context when switching between pages

## Page 1: Inspections Table

### Table Layout
**Columns (in order):**
1. **Select** - Checkbox for bulk selection
2. **Address** - Full property address
3. **Type** - Inspection type badge
4. **Date** - Formatted date (DD/MM/YYYY)
5. **Department** - Department badge/tag

### Filtering System
- **Department Filter**: Multi-select dropdown
  - Show department count badges
  - "Select All" / "Clear All" options
  - Search within departments for large lists

- **Date Filter**: Date picker with range selection
  - Quick presets: "Today", "This Week", "Next Week", "This Month"
  - Custom range picker
  - Clear filter option

### Data Management
- **Pagination**: Server-side pagination
  - Default: 50 items per page
  - Options: 25, 50, 100, 200
  - Show "X of Y" results counter

- **Selection Behavior**: 
  - Persist selections across pages
  - "Select All" applies to current page only
  - Clear selection button when items selected
  - Show selection count in header

### Empty States
- **No Results**: "No inspections found. Try adjusting your filters."
- **No Data**: "No unscheduled inspections at the moment."
- **Loading**: Skeleton loaders for table rows

## Design System

### Theming Strategy
- **Use Tailwind semantic tokens exclusively**
- **shadcn/ui components as base**
- **No hardcoded hex colors**
- Define custom variants in design system

### Color Palette (Semantic Tokens)
```css
/* Define in index.css */
--primary: /* Main brand color */
--secondary: /* Secondary actions */
--success: /* Completed states */
--warning: /* Pending/attention states */
--error: /* Error/cancelled states */
--muted: /* Subtle text/backgrounds */
```

### Typography Scale
- **Headings**: Clear hierarchy (H1, H2, H3)
- **Body**: Readable font size (16px base)
- **Labels**: Slightly smaller (14px)
- **Captions**: Smallest (12px) for metadata

### Component Variants
```typescript
// Example button variants
const buttonVariants = {
  variant: {
    default: "...",
    primary: "...",
    secondary: "...",
    ghost: "...",
    outline: "...",
  },
  size: {
    sm: "...",
    md: "...",
    lg: "...",
  }
}
```

## Tone and Voice

### Operational Efficiency
- **Concise**: Clear, action-oriented language
- **Professional**: Formal but friendly tone
- **Efficient**: Minimize cognitive load
- **Scheduler-friendly**: Use domain terminology

### Interface Copy Examples
- Buttons: "Schedule Selected", "Apply Filters", "Clear Selection"
- Messages: "3 inspections selected", "Filters applied", "No matches found"
- Headings: "Unscheduled Inspections", "Filter Options", "Selection Summary"

## Accessibility Standards

### Keyboard Navigation
- **Tab order**: Logical flow through interface
- **Focus indicators**: Clear visual focus states
- **Keyboard shortcuts**: 
  - `Ctrl/Cmd + A` - Select all visible
  - `Escape` - Clear selection/close modals
  - `Enter/Space` - Activate buttons/checkboxes

### Screen Reader Support
- **ARIA labels**: All interactive elements
- **Role attributes**: Proper semantic HTML
- **Live regions**: Dynamic content updates
- **Table headers**: Proper th/td associations

### Filter Accessibility
- **Label associations**: All form inputs properly labeled
- **Fieldset grouping**: Related filters grouped
- **Error messaging**: Clear validation feedback
- **State announcements**: Filter changes announced

## Responsive Behavior

### Breakpoints
- **Mobile**: < 768px - Stack filters, hide some columns
- **Tablet**: 768px - 1024px - Adjust table layout
- **Desktop**: > 1024px - Full feature set

### Mobile Adaptations
- Convert table to cards on mobile
- Stack filters vertically
- Larger touch targets (44px minimum)
- Swipe gestures for quick actions

## Performance Guidelines

### Loading States
- **Skeleton loaders**: For table rows during load
- **Spinner indicators**: For filter applications
- **Progressive loading**: Load critical content first

### Data Optimization
- **Virtual scrolling**: For large datasets
- **Debounced search**: 300ms delay on filter inputs
- **Cached results**: Store filter results temporarily
- **Optimistic updates**: Show changes immediately

## Future Considerations

### Scalability
- Design system ready for additional pages
- Component library extensible
- Consistent patterns across features

### Integration Points
- VRP optimizer results display
- WorkFeed API status indicators
- Real-time updates for availability changes