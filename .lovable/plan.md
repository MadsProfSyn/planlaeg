## Plan: verify new MAPBOX_TOKEN, fix stripFloorDoor, backfill remaining shifts

### Step 1 — Re-run the probe
Invoke `diag-geocode-probe` to test both addresses (`Gartnerbyen 53, 3. 5, 5200 Odense V` and `Hegnet 41, 4000 Roskilde`) live against Mapbox.

**Stop condition:** if either still returns 403, halt and report — do not touch code or run backfill.

### Step 2 — Fix `stripFloorDoor` regex (only if Step 1 returns 200)
Current regex over-strips: door numbers like `105` or `601` cause the postcode/city to be eaten. Tighten it to only match a floor token (`st`, `kl`, `k`, or `\d+\.`) optionally followed by a short door token (1–3 chars OR `tv`/`th`/`mf`), and stop at the next comma. Apply identically across all four functions that inline it:
- `geocode-monday-items`
- `geocode-addresses`
- `geocode-inspector`
- `sync-workfeed-shifts`
- `backfill-shift-geocodes`
- `diag-geocode-probe`

Re-probe one known-tricky address (e.g. `Strynøgade 5, 1. 105, 2100 København Ø`) to confirm the postcode survives.

### Step 3 — Run backfill on the 40 failed shifts
Invoke `backfill-shift-geocodes` scoped to rows where `geocode_status` is failed/null. Cache writes use both raw and stripped keys (already implemented).

### Step 4 — Confirm final state
Run `SELECT geocode_status, COUNT(*) FROM supabase_shifts GROUP BY 1` and report. Target: 0 failed rows other than genuine non-addresses.

### Notes
- No Mapbox dashboard changes, no token edits.
- No changes to `VITE_MAPBOX_PUBLIC_TOKEN` or any frontend code.
- If Step 1 fails, the only output is the probe result — no other actions.
