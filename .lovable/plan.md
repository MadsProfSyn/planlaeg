

## Speed up inspector loading on /planlaeg-syn

### Root Cause
The page calls the `fetch-available-inspectors` **Edge Function** which:
1. Has cold-start latency (Deno spin-up)
2. Makes 4 sequential DB queries: availability → inspectors → skills → capacity view
3. Transforms/joins everything server-side

But all this data **already exists in Supabase tables** synced by the cron job. The client can query these tables directly via the Supabase JS SDK, which is much faster (no Edge Function overhead).

### Solution
Replace the Edge Function call in `/planlaeg-syn` with direct Supabase client queries using `Promise.all` for parallel fetching.

### Changes

**File: `src/pages/PlanlaegSyn.tsx` (~lines 218-248)**

Replace the `supabase.functions.invoke("fetch-available-inspectors", ...)` call with direct queries:

```typescript
queryFn: async () => {
  if (!selectedDate) return { data: [] };

  // 1. Query supabase_availability directly
  let availQuery = supabase
    .from("supabase_availability")
    .select("*")
    .eq("is_available", true)
    .eq("date_local", selectedDate);

  if (selectedAfdeling !== "all") {
    availQuery = availQuery.eq("department", selectedAfdeling);
  }

  const { data: availData } = await availQuery;
  if (!availData?.length) return { data: [] };

  const inspectorIds = [...new Set(availData.map(r => r.inspector_id))];

  // 2. Parallel fetch: addresses, skills, capacity
  const [addressRes, skillsRes, capacityRes] = await Promise.all([
    supabase.from("inspectors").select("id, address").in("id", inspectorIds),
    supabase.from("inspector_skills").select("inspector_id, inspection_type").in("inspector_id", inspectorIds).eq("is_active", true),
    supabase.from("inspector_capacity_view").select("*").in("inspector_id", inspectorIds).eq("date_local", selectedDate),
  ]);

  // 3. Build maps and transform (same logic as Edge Function)
  // ... return { data: transformedData };
}
```

This eliminates the Edge Function cold start and runs all secondary queries in parallel instead of sequentially. Expected load time: **< 2 seconds** instead of 30-60 seconds.

### What stays the same
- The Edge Function itself is **not deleted** — it's still used by the Availability page, InspectorSelector dialogs, etc.
- The data shape returned stays identical so `InspectorsPanel` needs no changes.
- The cron jobs continue syncing data as before.

### Files Modified
- `src/pages/PlanlaegSyn.tsx` — replace Edge Function call with direct DB queries + client-side transform

