## Diagnosis

The regression is in `PlanlaegSynMapView.tsx`, in the custom orange inspector marker added for `Vis konsulenter`.

The issue appeared after adding the booked-count badge because the marker element now contains an absolutely positioned badge outside the 24×34 pin box:

```text
pin element: width 24px, height 34px
badge: position absolute; top -4px; right -6px
Mapbox marker anchor: bottom
```

Mapbox positions custom markers using the DOM element’s measured box and anchor. Because the badge visually extends outside the pin, the effective visual center/anchor no longer matches the actual pin tip. During zoom, Mapbox keeps the element’s anchor fixed, but the pin artwork appears to move because the anchor is being calculated against the wrong composite marker shape.

The blue/green default Mapbox markers do not drift because they use Mapbox’s built-in marker sizing/anchor logic. Only the orange custom inspector marker is affected.

## Proposed fix

1. Keep the booked-count number visually attached to the orange inspector pin.
2. Change the orange inspector marker so the outer Mapbox marker element has a stable fixed box that includes the badge area.
3. Place the SVG pin inside that fixed box at a known position.
4. Set the Mapbox marker `anchor` and `offset` so the geographic coordinate is locked exactly to the SVG pin tip, not to the badge-expanded visual bounds.

Concretely:

```text
outer marker box: fixed e.g. 34px × 40px
pin SVG: absolute left 5px top 4px, size 24px × 34px
badge: absolute top 0 right 0
marker anchor: bottom
offset: [0, -2] or equivalent calibrated value so the pin tip is the locked point
```

This makes the marker’s measured size stable and explicitly separates:

- the visual badge area
- the actual map coordinate anchor point

## Validation

After implementation I will verify that:

- orange inspector pin tips stay on the same map location while zooming in/out
- count badges still render correctly
- blue inspection pins and green booked-inspection pins are unchanged
- the map still loads correctly when switching to the `Kort` tab