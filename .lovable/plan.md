## Token read comparison

Both functions read `MAPBOX_TOKEN` the same way, per-invocation, inside the handler:

- `geocode-monday-items` line 106: `const mapboxToken = Deno.env.get('MAPBOX_TOKEN')!;`
- `sync-workfeed-shifts` line 188: `const mapboxToken = Deno.env.get("MAPBOX_TOKEN");` (then explicit `throw` if missing)

Same secret name, same call, same handler scope. The only textual difference is the `!` non-null assertion vs an explicit null-check — both end up with the same string at runtime. **Token reads are identical. The token is not the cause.**

## What the Step 1 probe actually showed

I called the backfill on the Bispevej row. The edge-function log shows exactly one line:

```
WARNING  Mapbox HTTP 403 for "bispevej 1c, 2400 københavn nv, danmark": {"message":"Forbidden"}
```

Meanwhile the shared cache already contains coordinates for the same address — but under a different key:

```
mapbox_coords_cache.normalized_address = "bispevej 1c, st. tv, 2400 københavn nv, danmark"
lat = 55.706712, lon = 12.530736
```

So the failure mode is a **cache-key mismatch**, not a token problem:

1. Bispevej was cached long ago using the raw address (floor/door intact).
2. The newer `stripFloorDoor` step normalizes to `"bispevej 1c, 2400 københavn nv, danmark"` before the cache lookup.
3. That stripped key misses the cache.
4. The function falls through to a live Mapbox call, which returns 403 for this particular query, and the row is marked `failed`.

Coordinates that we already paid Mapbox for are sitting in the cache and we are not finding them.

## Fix

Make `geocodeAddress` in `sync-workfeed-shifts` cache-compatible with both old and new keys, before any Mapbox call:

1. Build two normalized keys for every lookup:
   - `rawKey` = `${address.toLowerCase().trim()}, danmark` (no stripping — matches legacy cache entries written by the old Monday path)
   - `strippedKey` = `${stripFloorDoor(address).toLowerCase().trim()}, danmark` (matches the new convention)
2. Cache lookup order: `rawKey` first, then `strippedKey`. If either hits, use those coords and return `source: "cache"`. Skip Mapbox entirely.
3. On a true miss, call Mapbox once with `strippedKey` (better hit-rate for v5 in DK), and on success write the result under **both** keys via two upserts so subsequent lookups from either convention hit.
4. On Mapbox miss/error, keep the current behavior: log + set `geocode_status='failed'`, do not silently null-fill.

No change to `geocode-monday-items`. No change to any Mapbox token, dashboard restriction, or `VITE_MAPBOX_PUBLIC_TOKEN`. No schema change (`geocode_status` already exists).

## Validation

1. Deploy `sync-workfeed-shifts` with the cache-compatibility fix.
2. Call `backfill-shift-geocodes` with `{ shift_ids: ["3f9ba634-f074-4730-bb71-9fe60619abb5"] }` (the Bispevej row).
3. Confirm it resolves from cache, returns `from_cache: 1`, and the row now has `lat=55.706712, lng=12.530736, geocode_status='success'`. Report the proof.
4. Then run the backfill on the remaining ~377 failed/null rows in batches; report cache vs. Mapbox split and any residual failures.

## Files touched

- `supabase/functions/sync-workfeed-shifts/index.ts` — only the `geocodeAddress` helper.
- No other files.
