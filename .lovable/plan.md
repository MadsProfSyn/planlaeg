## What's wrong

The route map on `/planlaeg-syn` only draws a route when the selected inspector's `shift_details` entries have `lat`/`lng`. For most inspectors those fields come back `null`, so the map only zooms to the home pin and skips the polyline. Henrik works by coincidence — his shift addresses happen to have a cache row that matches the broken join.

Root cause is a normalization mismatch between writers and reader of `mapbox_coords_cache`:

- All geocoder edge functions (`sync-workfeed-shifts`, `geocode-addresses`, `geocode-monday-items`, `geocode-inspector`) store rows as:
  `normalized_address = lower(trim(address)) || ', danmark'`
- But `inspector_capacity_view` joins shifts to the cache with:
  `lower(trim(ss.address)) = mcc.normalized_address`  ← missing the `, danmark` suffix

Result: the join misses almost every shift, `lat`/`lng` come back `null`, and `PlanlaegSynMapView` filters those shifts out before building waypoints — so no polyline is drawn.

## Fix

Recreate `inspector_capacity_view` with the join condition aligned to the writers' normalization:

```sql
LEFT JOIN mapbox_coords_cache mcc
  ON mcc.normalized_address = lower(trim(ss.address)) || ', danmark'
```

Everything else in the view stays the same (columns, grouping, filters, status logic). This is a pure view recreation — no data migration, no table changes.

## Why this is enough

- `sync-workfeed-shifts` already geocodes shift addresses into `mapbox_coords_cache` on every sync, so rows exist for current shifts — they just weren't being matched.
- Once the join matches, `shift_details[i].lat/lng` populates for all inspectors whose shift address is in the cache, and `PlanlaegSynMapView` will build the base → 1 → 2 → … polyline like it does for Henrik today.
- No frontend changes needed. No edge function changes needed.

## Out of scope

- Backfilling cache rows for shifts whose addresses have never been geocoded (rare — `sync-workfeed-shifts` handles this on its regular cron). If, after this fix, a specific inspector still shows no route, the next step is to run a one-off geocode of their shift addresses, but that should not be needed for the cases the user reported.
- Touching `RouteMapView` or `mapbox-directions.ts` — the Mapbox Directions calls themselves are working (Henrik's route proves it).
