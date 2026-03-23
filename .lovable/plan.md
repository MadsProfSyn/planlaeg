
Goal: Make “Tilgængelige konsulenter” scroll internally while “Synsopgaver” stays visible, without relying on breakpoint changes.

What’s actually wrong now
1) The height chain is not fully bounded all the way down to the right `ScrollArea`.
2) `PlanlaegSyn` uses `h-full`, but ancestors still allow content-driven growth in some cases.
3) The two-column grid row is implicit `auto` height, so cards can expand with content instead of being forced into a fixed row height.
4) Some flex/grid children in the chain are missing `min-h-0`, so they don’t shrink into a scroll region.

Implementation plan

1) Bound the app-shell height in `src/components/AppLayout.tsx`
- Make the shell explicitly viewport-bounded (`h-svh`/`h-screen` style behavior, not only `min-h-*`).
- Ensure vertical flex children can shrink:
  - content column: add `min-h-0`
  - `<main>`: keep it as the app scroll container but add `min-h-0` explicitly.
- Keep existing behavior for other pages (no route logic needed).

2) Make `/planlaeg-syn` consume bounded height correctly in `src/pages/PlanlaegSyn.tsx`
- Keep two columns (`grid-cols-2`) as requested.
- Ensure page root is `h-full min-h-0 overflow-hidden`.
- Mark top blocks (title + filters/actions) as non-shrinking.
- Make the panel area the only growing/shrinking region:
  - `flex-1 min-h-0 overflow-hidden`
  - set grid row sizing to a bounded row (`grid-rows-1` / `minmax(0,1fr)`), so cards cannot auto-grow with content.
- Ensure both grid children are `h-full min-h-0 overflow-hidden`.

3) Force panel internals to be true scroll containers
- `src/components/planlaeg-syn/InspectorsPanel.tsx`
- `src/components/planlaeg-syn/InspectionsPanel.tsx`
- For each panel:
  - `Card`: `h-full min-h-0 flex flex-col overflow-hidden`
  - `CardContent`: `flex-1 min-h-0 overflow-hidden`
  - `ScrollArea`: `h-full min-h-0`
- This guarantees only content area scrolls, while card headers remain fixed.

4) Optional scroll-chain hardening (only if needed after step 1–3)
- Add overscroll containment on scroll viewport (via `scroll-area.tsx` or local panel wrapper) to prevent wheel/touch chaining to page container at list edges.

Technical details (exact intent, concise)
- Do not treat `grid-cols-2` as the fix.
- The fix is: explicit height constraints + `min-h-0` at every shrink boundary + bounded grid row sizing.
- The right list must live inside a bounded ancestor chain; otherwise it will expand instead of scroll.

Files to update
1. `src/components/AppLayout.tsx`
2. `src/pages/PlanlaegSyn.tsx`
3. `src/components/planlaeg-syn/InspectorsPanel.tsx`
4. `src/components/planlaeg-syn/InspectionsPanel.tsx`
5. (If needed) `src/components/ui/scroll-area.tsx`

Verification checklist
1) On `/planlaeg-syn` at 673x494, add enough consultants to overflow.
2) Scroll inside right panel: only right list moves.
3) Left panel (“Synsopgaver”) remains visible in place.
4) Header/filters/actions remain fixed at top of page area.
5) No vertical growth of the page from consultant content.
