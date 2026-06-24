## Diagnosis

The Mapbox integration itself is correct — same pattern as `RouteMapView.tsx` (`mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN`, `streets-v12` style). The toggles render correctly with the right counts (17 / 23), which means data and component mount fine. The white area is almost certainly the **map canvas rendering at 0×0 px** — a classic Mapbox-GL pitfall when the container is sized by flexbox.

Why: when `mapboxgl.Map` is constructed, it measures the container *once*. If the container's computed height is 0 at that moment (because the flex chain hasn't settled, or because the tab content was just switched in), the canvas stays 0×0 and you get a fully white box even after tiles load. RouteMapView avoids this because it lives in a modal with a fixed pixel height.

The chain today:

```text
page root .........  flex flex-col h-full
  └ tab wrapper ...  flex-1 min-h-0 mt-4 overflow-hidden     ← height fine
      └ MapView ...  flex flex-col h-full gap-3
          ├ toggles  (auto height)
          └ canvas   flex-1 min-h-0 w-full                  ← can resolve to 0 during init
```

## Fix

Edit only `src/components/planlaeg-syn/PlanlaegSynMapView.tsx`:

1. Give the map container a guaranteed size so Mapbox always initializes onto a non-zero box:
   - Use `h-[600px]` (or `min-h-[500px] flex-1`) instead of bare `flex-1 min-h-0`.
2. After init, call `map.resize()` once the style loads, and again whenever the container size could change:
   - `map.on('load', () => map.resize())`
   - Add a `ResizeObserver` on the container that calls `map.resize()` (covers tab switches and window resizes).
3. Add a small diagnostic `console.log` on init failure / token missing so future regressions surface in the console.
4. Confirm the token is present at runtime (it is in `.env`, but log a warning if `import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN` is empty so we get a clear signal instead of a white box).

No changes to `PlanlaegSyn.tsx`, no DB or edge-function changes, no new dependencies — `mapbox-gl` is already installed and the same public token is already working for `RouteMapView`.

## Verification

After the change, open `/planlaeg-syn`, switch to the **Kort** tab with a date selected, and confirm:
- Map tiles render (Denmark visible, then auto-fit to markers).
- Blue inspection markers and amber inspector markers appear.
- Toggling each layer hides/shows the corresponding markers.
- Switching back to Planlægning and returning to Kort still renders correctly (ResizeObserver handles re-mount sizing).