## Files involved

- `src/components/AppLayout.tsx` — shared layout used by every routed page in `src/App.tsx` (wraps children with `SidebarProvider` + `AppSidebar` + `<header>` + `<main>`). This is the only place the top bar lives.
- `src/components/AppSidebar.tsx` — left sidebar (shadcn `Sidebar`). Currently has `SidebarHeader` + `SidebarContent` only; we'll add a `SidebarFooter` with the profile block.

Spacing audit (rg for `pt-16|pt-14|mt-16|top-16|top-[64px]|h-16`):
- `src/components/AppLayout.tsx:38` — the `h-16` header itself (deleted).
- `src/pages/admin/AdminLayout.tsx:37` — unrelated; this is a separate (unused-by-routes) admin layout, not wired into `App.tsx`. Leave untouched.
- `src/components/inspections/MondayItemsTable.tsx:98` — `h-16` on a skeleton row, unrelated to header. Leave untouched.

No `pt-16` / `mt-16` / `top-16` / `top-[64px]` / `pt-14` matches anywhere in `src/`. No page-level offsets to remove — pages already render flush inside `<main>`.

## Changes

### 1. `src/components/AppLayout.tsx`

- Delete the entire `<header>` element (the `h-16` bar containing `SidebarTrigger` + profile `DropdownMenu`).
- Remove the now-unused imports: `Button`, `DropdownMenu*`, `Avatar*`, `LogOut`, `User`, `SidebarTrigger`, `useAuth`, the `getInitials` helper. Keep `SidebarProvider` and `AppSidebar`.
- The right column becomes just `<main className="flex-1 overflow-auto min-w-0 min-h-0">{children}</main>` so page content starts at viewport top with no gap.

### 2. `src/components/AppSidebar.tsx`

- Import `SidebarFooter` from `@/components/ui/sidebar`, plus `useAuth`, `Button`, `DropdownMenu*`, `Avatar*`, `LogOut`, `SidebarTrigger`.
- Move the `getInitials` helper and the profile `DropdownMenu` (avatar trigger → label with name/email/admin badge → `Log ud` item calling `signOut()`) from `AppLayout` into a new `<SidebarFooter>` rendered after `<SidebarContent>`. Shadcn's `SidebarFooter` is already styled as a bottom-pinned flex region (the `Sidebar` shell is `flex-col` and `SidebarContent` has `flex-1`), so the footer naturally anchors at the bottom regardless of nav item count — no manual `mt-auto` needed.
- Footer layout: a single row with the avatar `DropdownMenuTrigger` on the left and the existing `SidebarTrigger` (collapse toggle) on the right, so users keep the ability to collapse the sidebar now that the header trigger is gone.
- Preserve all dropdown behavior verbatim (label block, separator, sign-out item).

### 3. No other files

No page wrappers, no routes, no nav items change. Confirmed by the rg sweep above.

## Verification

- Every route renders with no top bar and no blank gap at the top of `<main>`.
- Profile avatar sits at the bottom of the sidebar; dropdown opens with name/email/admin badge and `Log ud` still calls `signOut()`.
- Resizing the window: nav stays at top, profile stays pinned at bottom (via `SidebarContent` `flex-1` pushing `SidebarFooter` down).
- Sidebar can still be toggled via the `SidebarTrigger` now living in the sidebar footer.