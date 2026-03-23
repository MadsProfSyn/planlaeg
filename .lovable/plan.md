

## Fix 3 issues on /alle-syn

### Issue 1: Comma in search causes 400 error
The comma in search strings like `Søndre Fasanvej 90,` breaks the PostgREST `.or()` filter syntax because commas are used as delimiters in the `or()` expression. Need to escape or strip commas from the search query before passing to Supabase.

**File: `src/pages/AlleSyn.tsx` (line ~66-69)**
- Sanitize the search query by replacing commas with spaces (or stripping them) before building the `.or()` filter. This preserves the search intent while avoiding the PostgREST parsing error.

### Issue 2: Remove time from Dato/tid column
The `02:00` shown is likely a timezone artifact from the stored timestamp. The time is not meaningful.

**File: `src/components/alle-syn/AlleSynTable.tsx` (line ~101-103)**
- Change the date format from `"dd. MMM yyyy HH:mm"` to `"dd. MMM yyyy"` to drop the time portion.

### Issue 3: Date picker too wide
The `SingleDatePicker` button has `w-full` which stretches it to fill available space.

**File: `src/components/alle-syn/AlleSynFiltersBar.tsx`**
- Either pass a className or wrap the `SingleDatePicker` in a container with a fixed width (e.g. `w-[180px]`).
- Alternatively, change the `SingleDatePicker` trigger from `w-full` to `w-auto` or add a width prop. Since `SingleDatePicker` is shared, safest to constrain width at the call site in `AlleSynFiltersBar`.

