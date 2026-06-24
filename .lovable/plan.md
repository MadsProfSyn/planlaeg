## Change

Hide the floating sidebar-toggle "sticker" (bottom-left) whenever the sidebar is open. Show it only when the sidebar is collapsed (desktop) or closed (mobile).

## File

`src/components/AppLayout.tsx` — only file touched.

## How

Read sidebar state via the `useSidebar()` hook from `@/components/ui/sidebar`. Since the hook must be called inside `<SidebarProvider>`, extract a tiny child component:

```tsx
function CollapsedSidebarTrigger() {
  const { state, isMobile, openMobile } = useSidebar();
  const hidden = isMobile ? openMobile : state === "expanded";
  if (hidden) return null;
  return (
    <SidebarTrigger
      className="fixed bottom-3 left-3 z-50 h-8 w-8 rounded-md border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-md hover:bg-sidebar-accent"
      aria-label="Toggle sidebar"
    />
  );
}
```

Replace the always-rendered `<SidebarTrigger>` in `AppLayout` with `<CollapsedSidebarTrigger />`. Behavior: sticker disappears when sidebar is expanded, reappears when collapsed. The sidebar itself already has its own internal toggle for closing, so users can still hide it.
