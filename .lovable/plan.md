

## Sidebar Changes

### 1. Hide ProfSyn AI and Planlagte syn from Navigation

Add `hidden: true` to those two items in the `navigationItems` array and filter them out during rendering.

### 2. Make Admin section a collapsible dropdown

Use the Radix `Collapsible` component (already available) to wrap the Admin section. The "Admin" label becomes a clickable trigger with a chevron icon that toggles the admin menu items open/closed.

### Files Modified

| File | Change |
|------|--------|
| `src/components/AppSidebar.tsx` | Add `hidden` flag to ProfSyn AI & Planlagte syn items; filter them out in render; wrap Admin section in `Collapsible` with clickable trigger |

### Implementation Details

**Navigation items** - Add `hidden: true` to the ProfSyn AI and Planlagte syn entries. Filter with `if (item.hidden) return null` in the render loop.

**Admin collapsible** - Replace the static `SidebarGroupLabel` with a `Collapsible` wrapper. Use local state `adminOpen` (default `false`). The trigger shows "Admin" with a `ChevronDown`/`ChevronRight` icon. The admin menu items render inside `CollapsibleContent`. Auto-open if user is on an admin route.

