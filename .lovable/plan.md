## Goal
`sync-workfeed-shifts` must produce the same lat/lng as the Monday path for identical addresses. Make failures observable. Reuse the shared cache. Backfill the 379 null rows.

## Step 1 — Verify the actual cause on one address

Before any code change, run a one-shot probe in `sync-workfeed-shifts` (temporary log) or a tiny standalone Deno script invoked once via the edge runtime that:
- prints `typeof MAPBOX_TOKEN` and `MAPBOX_TOKEN?.length` (never the value),
- calls Mapbox v5 with `'bispevej 1c, st. tv, 2400 københavn nv, danmark'` already-normalized,
- prints status code + `features.length`.

Two possible outcomes:
- Token is undefined at module load → confirms the "module-load token + silent `!MAPBOX_TOKEN` return" theory.
- Token is fine and Mapbox returns features → confirms the bug is one of: cache key mismatch at write time, the `upsert` silently failing, or an exception in the insert path that's being swallowed. Report which.

Only proceed once the probe identifies the exact branch.

## Step 2 — Schema change (migration)

Add observability column:

```sql
ALTER TABLE public.supabase_shifts
  ADD COLUMN IF NOT EXISTS geocode_status text NOT NULL DEFAULT 'pending';
CREATE INDEX IF NOT EXISTS supabase_shifts_geocode_status_idx
  ON public.supabase_shifts (geocode_status);
```

Values: `pending` | `success` | `failed` | `no_address`. No RLS change (table already has policies).

## Step 3 — Fix `sync-workfeed-shifts/index.ts`

Minimal, surgical edits — do not touch normalization or the Monday function:

1. **Read token per-invocation.** Delete the module-top `const MAPBOX_TOKEN = …`. Inside `serve(...)` (top of handler), call `const mapboxToken = Deno.env.get("MAPBOX_TOKEN")`. Pass it into `geocodeAddress(supabase, address, mapboxToken)`. If missing → log a single explicit `console.error("MAPBOX_TOKEN missing at runtime")` and return 500 (do not silently null-fill the whole sync).
2. **Cache-first, then Mapbox, then write-back.** Keep the existing cache lookup. On miss, call Mapbox; on hit features, `upsert` into `mapbox_coords_cache` with `onConflict: "normalized_address"` (already correct). This is the parity behavior with the Monday function.
3. **Observability.** Replace silent `return null`:
   - no address → `geocode_status = 'no_address'`, `lat/lng = null`, `console.warn` with shift id.
   - 0 features → `geocode_status = 'failed'`, log `console.warn` with the normalized string and shift id.
   - exception → `geocode_status = 'failed'`, log full error.
   - success → `geocode_status = 'success'`, set lat/lng.
4. **Final summary log.** Extend the existing summary with `geocoded_success`, `geocoded_failed`, `no_address` counters.

Do not change CORS, the clean-slate delete, or any other logic.

## Step 4 — Backfill the 379 null rows

Add a separate edge function `backfill-shift-geocodes` (small, idempotent, callable on demand):

- Selects rows: `lat IS NULL AND address IS NOT NULL AND geocode_status IN ('pending','failed')`.
- Processes in batches of 50 with the same `geocodeAddress` helper (cache-first → Mapbox on miss).
- Updates each row in place with `lat`, `lng`, `geocode_status`.
- Returns counts `{ processed, from_cache, from_mapbox, failed }`.
- Run it once from the chat after deploy via `supabase--curl_edge_functions`. Re-runnable safely.

Cache reuse means most of the 379 rows whose addresses Monday already geocoded will resolve with zero Mapbox calls.

## Step 5 — Proof gate

Before mass backfill, call the backfill function with a single `shift_id` filter (add an optional `{ shift_ids?: string[] }` body param) for a known failing row, e.g. the 'Bispevej 1C, st. tv, 2400 København NV' shift. Report:
- before: `lat=null, lng=null, geocode_status='pending'`
- after: `lat=…, lng=…, geocode_status='success'`, source `cache` or `mapbox`.

Only after that confirmation, run with no filter to backfill all 379.

## Step 6 — Re-run the regular sync once

After backfill, invoke `sync-workfeed-shifts` for a 1-day window and verify new inserts now carry `geocode_status='success'` for addresses already in cache. Report the summary counters.

## Out of scope
- `geocode-monday-items`: untouched.
- Route map / front-end: untouched.
- Address normalization: untouched (already byte-identical between the two paths).

## Files touched
- `supabase/functions/sync-workfeed-shifts/index.ts` — token read timing, status writes, logs.
- `supabase/functions/backfill-shift-geocodes/index.ts` — new.
- `supabase/config.toml` — register new function.
- One migration adding `supabase_shifts.geocode_status`.

## Reporting at the end
Post a short note stating which branch the Step-1 probe identified as the actual cause (module-load token vs cache-write mismatch vs swallowed exception), and the before/after for the proof address.
