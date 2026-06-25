## Findings so far

- I have not touched any Mapbox token, dashboard setting, or code.
- The two functions currently build the Mapbox URL in the same way for `Hegnet 41, 4000 Roskilde`.
- WorkFeed row exists:
  - `supabase_shifts.address = Hegnet 41, 4000 Roskilde`
  - `geocode_status = failed`
  - `lat/lng = null`
- Cache has no `Hegnet 41` entry, so WorkFeed falls through to a live Mapbox call.
- Recent `backfill-shift-geocodes` logs show:
  - `Mapbox HTTP 403 for "hegnet 41, 4000 roskilde, danmark"`
- There is no existing Monday item with `Hegnet 41` in `monday_items_selected`, and no recent `geocode-monday-items` logs for that address, so I cannot honestly claim Monday succeeds for this exact row from existing evidence.

## Exact URL construction from source

For `Hegnet 41, 4000 Roskilde`, both paths normalize to:

```text
hegnet 41, 4000 roskilde, danmark
```

Both source files currently build this final URL:

```text
https://api.mapbox.com/geocoding/v5/mapbox.places/hegnet%2041%2C%204000%20roskilde%2C%20danmark.json?access_token=[REDACTED]&country=DK&limit=1
```

## Required next investigation step

To complete the test exactly as requested, I need to run a controlled live probe that does not change token settings:

1. Add or use a temporary/probe endpoint or one-off diagnostic path that calls the Monday normalization + fetch logic for the literal address without inserting/updating Monday rows.
2. Call the WorkFeed/backfill geocoding logic for the same literal address in diagnostic mode without updating `supabase_shifts`.
3. Return, in the response only:
  - Monday final URL with token redacted
  - Monday HTTP status
  - Shift final URL with token redacted
  - Shift HTTP status
  - `stripFloorDoor('Strynøgade 5, 1. 105')`
  - `stripFloorDoor('Roskildevej 33A, 5. 601')`

## If approved, I will only investigate first

- No token changes.
- No Mapbox dashboard changes.
- No production geocode backfill yet.
- No fix until after the report confirms whether the URLs/statuses differ.  
  
Approved to investigate only — no token changes, no dashboard changes, no backfill, no fix. But your Hegnet 41 probe can't answer the question: both paths build an identical URL with the same token, so both will return the same status, proving nothing. And Monday never geocoded Hegnet 41, so it can't serve as the "Monday succeeds" control. Add this to the probe. Pick an address that DID succeed as a live Monday geocode — find one in monday_items_selected with geocode_status='success' whose coordinates were NOT a cache hit (a fresh live geocode), ideally one that does NOT appear in mapbox_coords_cache as a pre-existing entry. Then, server-side, in diagnostic mode (no writes): - call Mapbox for THAT known-good Monday address → report HTTP status - call Mapbox for a failing shift address (Hegnet 41) → report HTTP status Both calls use the same MAPBOX_TOKEN, same code, back to back, same function invocation. Interpretation: - If the known-good Monday address returns 200 and Hegnet 41 returns 403 in the SAME run → the token works server-side; the 403 is specific to these 40 addresses' content. Then show stripFloorDoor output for 'Strynøgade 5, 1. 105' and 'Roskildevej 33A, 5. 601' and the raw Mapbox 403 response body for Hegnet 41. - If BOTH return 403 in the same run → the token cannot geocode server-side at all, and Monday's successes were cache/precomputed, not live server calls. Say so explicitly. Also: print the full Mapbox 403 response BODY for Hegnet 41 (not just the status). Mapbox puts the reason in the body — 'Forbidden' (token/URL) reads very differently from a malformed-query or rate message. Report all of it before proposing any fix.