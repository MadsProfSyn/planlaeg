## Root cause

On the map tab, the map filters shifts by `typeof lat === "number" && typeof lng === "number"`. Any shift where `lat`/`lng` come back `null` is silently dropped from the numbered route markers.

For Rasmus Kristiansen on Monday 3 August, the DB view `inspector_capacity_view` returns 6 shifts, but 3 of them have `lat: null, lng: null`:

| Shift | Address | lat/lng |
|---|---|---|
| 08:00–08:55 IF | Skovvejen 15, 2. 5, 8000 Aarhus C | NULL |
| 08:55–09:50 IF | Skovvejen 15, 1. 3, 8000 Aarhus C | NULL |
| 10:10–11:10 IF | Sønder Allé 9, 3. tv, 8000 Aarhus C | ok |
| 11:10–12:10 IF | Amaliegade 20B, 2. 2, 8000 Aarhus C | NULL |
| 13:35–14:30 IF | Amaliegade 20B, 8000 Aarhus C | ok |
| 14:50–15:45 IF | Dirch Passers Gade 30, 2. tv, 8000 Aarhus C | ok |

Those are exactly the 3 the user cannot see on the map.

### Why lat/lng is NULL

`inspector_capacity_view` joins shift addresses to the geocode cache using an **exact string match**:

```sql
LEFT JOIN mapbox_coords_cache mcc
  ON mcc.normalized_address = lower(trim(ss.address)) || ', danmark'
```

But `mapbox_coords_cache.normalized_address` is written by the geocoding Edge Function using a **different normalisation** — it strips Danish floor/door segments (`stripFloorDoor`) before storing. So the cache contains:

- `skovvejen 15, 8000 aarhus c, danmark`
- `amaliegade 20b, 8000 aarhus c, danmark`

…but the view looks for:

- `skovvejen 15, 2. 5, 8000 aarhus c, danmark`
- `amaliegade 20b, 2. 2, 8000 aarhus c, danmark`

No match → NULL → shift dropped from the map. The base address (Amaliegade 20B without floor/door) happens to match verbatim, which is why that one row succeeds.

The pattern is: any shift whose address contains a floor/door segment (`, 2. 5`, `, 1. 3`, `, 2. 2`, `, st. tv`, etc.) will always miss the cache, even after successful geocoding — which is why the same 3 keep disappearing.

### Where the fix belongs (for a follow-up build turn)

Two symmetrical options, only one is needed:

1. **Fix the view's join key** to strip floor/door before matching (mirror `stripFloorDoor` + append `, danmark`). This aligns the view with the writer and immediately un-hides the 3 shifts with no re-geocoding.
2. **Also** (recommended in addition) write a small helper SQL function `normalize_dk_address(text)` used by both the view and any future geocoder path, so drift can't recur.

No frontend change is needed — the map's `typeof number` filter is correct; it just never received coordinates for those rows.

## Deliverable of this turn

This is investigation only, per the request. No code changes proposed for approval yet — confirm you want me to fix it via option 1 (patch the view) or option 1 + 2 (view + shared normaliser), and I will write the migration in the next turn.