## Validate the SQL normalizer before rebuilding the view

The previous migration attempt bundled the helper function and the `inspector_capacity_view` rebuild in one step. The user is right to gate this: the regex `,\s*(st\.?|kl\.?|\d+\.?)\s*(tv|th|mf|mid|sal|\.?\s*\d+)?(,|$)` is the same shape that has misbehaved twice before, and if the SQL string doesn't produce byte-identical output to the TypeScript `stripFloorDoor`, the view rebuild fixes nothing.

Split into two turns.

### Turn 1 (this migration) — function only

Create `public.normalize_dk_address(text)` and nothing else. No behavior change: the view still uses its old exact-match join and continues to return NULL for the same shifts. Adding the function alone cannot break anything.

```sql
CREATE OR REPLACE FUNCTION public.normalize_dk_address(addr text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(trim(
    regexp_replace(
      regexp_replace(
        COALESCE(addr, ''),
        ',\s*(st\.?|kl\.?|\d+\.?)\s*(tv|th|mf|mid|sal|\.?\s*\d+)?(,|$)',
        '\3',
        'gi'
      ),
      '\s{2,}', ' ', 'g'
    )
  )) || ', danmark'
$$;
```

### Turn 2 — three acceptance tests, then decide

Run all three read-only queries; go/no-go depends on the results.

1. Shape check — every row must keep postcode + city:
   ```sql
   SELECT addr, public.normalize_dk_address(addr) AS normalized
   FROM (VALUES
     ('Skovvejen 15, 2. 5, 8000 Aarhus C'),
     ('Amaliegade 20B, 2. 2, 8000 Aarhus C'),
     ('Amaliegade 20B, 8000 Aarhus C'),
     ('Strynøgade 5, 1. 105, 2100 København Ø'),
     ('Roskildevej 33A, 5. 601, 2500 Valby'),
     ('Bispevej 1C, st. tv, 2400 København NV'),
     ('Hegnet 41, 4000 Roskilde'),
     ('Gartnerbyen 2, 5. 5, 5200 Odense V')
   ) AS t(addr);
   ```

2. Cache-hit lift — must jump meaningfully vs the current baseline:
   ```sql
   SELECT count(*) AS total_shifts,
          count(mcc.normalized_address) AS would_match_cache
   FROM supabase_shifts ss
   LEFT JOIN mapbox_coords_cache mcc
     ON mcc.normalized_address = public.normalize_dk_address(ss.address);
   ```

3. Original repro — all 6 Rasmus rows must resolve:
   ```sql
   SELECT ss.address, mcc.lat, mcc.lon
   FROM supabase_shifts ss
   LEFT JOIN mapbox_coords_cache mcc
     ON mcc.normalized_address = public.normalize_dk_address(ss.address)
   WHERE ss.inspector_name = 'Rasmus Kristiansen'
     AND ss.date_local = '2026-08-03';
   ```

**Go criteria (all must hold):**
- Test 1: no row collapses to just the street; every result contains the original postcode and city.
- Test 2: `would_match_cache` climbs substantially over the current baseline (~243).
- Test 3: all 6 Rasmus rows return non-null `lat` / `lon`.

If any test fails, stop and inspect `mapbox_coords_cache.normalized_address` to find where SQL and TS diverge — do not rebuild the view.

### Turn 3 (only after Turn 2 passes) — rebuild the view

`CREATE OR REPLACE VIEW public.inspector_capacity_view` with the join changed to:
```sql
LEFT JOIN mapbox_coords_cache mcc
  ON mcc.normalized_address = public.normalize_dk_address(ss.address)
```
Everything else in the view is preserved verbatim. No frontend changes.

## What this turn will do

I will call the migration tool with **only the `CREATE OR REPLACE FUNCTION`** above — no view change. After you approve and run it, I will execute the three acceptance queries and report the numbers before proposing the view rebuild.