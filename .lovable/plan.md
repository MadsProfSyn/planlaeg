

## Add Geocoding for Inspector Addresses

### Problem
The `inspectors` table has `lat`, `lng`, and `geocode_status` columns, but nothing populates them. When an inspector's address is added/updated via `EditInspectorDialog`, only the text is saved. The VRP system's `get_vrp_input` function filters `i.lat IS NOT NULL`, so inspectors without geocoded addresses are excluded from route optimization.

### Approach
Create a new edge function `geocode-inspector` that geocodes a single inspector's address using the same Mapbox + cache pattern as `geocode-monday-items`. Call it from `EditInspectorDialog` after a successful address save, fire-and-forget style.

### Implementation

**1. New Edge Function: `supabase/functions/geocode-inspector/index.ts`**
- Accepts `{ inspector_id: string }` in body
- Fetches the inspector's address from the `inspectors` table
- If address is null/empty, sets `geocode_status = 'no_address'`, clears lat/lng, returns
- Normalizes address, checks `mapbox_coords_cache`
- If cache miss, calls Mapbox Geocoding API (country=DK)
- Caches result in `mapbox_coords_cache`
- Updates `inspectors` row: `lat`, `lng`, `geocode_status = 'success'`
- On error: sets `geocode_status = 'failed'`, `geocode_error = message`

**2. Update `supabase/config.toml`**
- Add `[functions.geocode-inspector]` with `verify_jwt = false`

**3. Update `src/components/inspectors/EditInspectorDialog.tsx`**
- After the successful `.update()` call (line ~112), check if address changed
- If changed, fire-and-forget: `supabase.functions.invoke("geocode-inspector", { body: { inspector_id: inspector.id } })`
- No need to await — geocoding happens in background

**4. Update `supabase/functions/sync-workfeed-inspectors/index.ts`**
- After inserting a new inspector, invoke `geocode-inspector` for any new inspector that has an address (fire-and-forget via `fetch` to the edge function URL)

### Files Changed
- `supabase/functions/geocode-inspector/index.ts` — new edge function
- `supabase/config.toml` — register function
- `src/components/inspectors/EditInspectorDialog.tsx` — trigger geocoding on address change
- `supabase/functions/sync-workfeed-inspectors/index.ts` — trigger geocoding for new inspectors

