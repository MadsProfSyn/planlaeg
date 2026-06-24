## Problem

Mapbox can't geocode Danish addresses that include floor/door notations (`, 1. 11`, `, 6. th`, `, st. tv`, `, 2. sal`, `, 3. mf`). The current `normalizeAddress` in every geocoder just lowercases and appends `, danmark` — the floor segment stays in the query and Mapbox returns no result. Inspections from Monday with these suffixes never get coordinates, so `/planlaeg-syn` can't compute driving distances for them.

## Fix

Strip Danish floor/door segments before geocoding, in every geocoder edge function. The clean address is what we send to Mapbox AND what we use as the `mapbox_coords_cache.normalized_address` key, so cache hits keep working.

### 1. Shared cleaner (inlined per function, since edge functions don't share modules)

```ts
// Removes Danish floor/door segments like ", 1. 11" / ", 6. th" / ", st. tv" / ", 2. sal" / ", 3. mf"
function stripFloorDoor(address: string): string {
  return address.replace(
    /,\s*(st\.?|kl\.?|\d+\.?)\s*(tv|th|mf|mid|sal|\.?\s*\d+)?(?=,|$)/gi,
    ''
  ).replace(/\s{2,}/g, ' ').trim();
}

function normalizeAddress(address: string): string {
  return `${stripFloorDoor(address).toLowerCase().trim()}, danmark`;
}
```

Verified against representative samples — keeps `, 2200 København N` intact, removes the floor segment whether it appears mid-address or at the end.

### 2. Files to update

Replace `normalizeAddress` in:
- `supabase/functions/geocode-monday-items/index.ts`
- `supabase/functions/geocode-addresses/index.ts`
- `supabase/functions/geocode-inspector/index.ts`
- `supabase/functions/sync-workfeed-shifts/index.ts`

All four already use the same `lower(trim(...)) || ', danmark'` shape, so changing the helper in-place is enough — no call-site changes.

### 3. Backfill the items that already failed

After the deploy, re-trigger geocoding for the stuck rows so `/planlaeg-syn` immediately sees their coords:

```sql
UPDATE public.monday_items_selected
SET geocode_status = 'pending'
WHERE geocode_status = 'failed'
  AND adresse ~* ',\s*(st\.?|\d+\.?)\s*(tv|th|mf|sal|\d+)';
```

Then invoke `geocode-monday-items` with those IDs in batches (same pattern used last sync) so they hit Mapbox once and populate `mapbox_coords_cache`.

For shifts, the next `sync-workfeed-shifts` run will re-geocode any address whose cache row is missing, so no manual step needed there — but we can optionally invoke it once after the deploy to refresh today's window immediately.

### 4. Out of scope

- Touching the cache rows that were created with the *old* (un-stripped) key. They're harmless: future lookups use the new stripped key and miss → Mapbox is called once → a new clean row is written. Old rows can be cleaned up later if desired.
- Changing `inspector_capacity_view` (already fixed last turn).
- Frontend changes.

## Why this is enough

Mapbox returns the building-level coordinate from the street + number + postcode alone — the floor/door has no geographic meaning. Stripping it server-side, in the same place we normalize for the cache, guarantees the geocoder sees a clean query and the cache key is stable across every writer/reader.
