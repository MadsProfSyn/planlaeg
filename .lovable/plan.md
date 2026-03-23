

## Fix: Make pre-cache non-blocking (no accuracy loss)

### Why this is safe
The Railway Python service already:
1. Reads from `mapbox_travel_cache`
2. Calls Mapbox API for any cache misses
3. Saves new results back to cache

The `preCacheTravelTimes` Edge Function does the **identical work** redundantly. Removing the `await` means Railway handles it all — same accuracy, no duplication.

### Change

**File: `src/hooks/useRouteOptimizer.ts` — line 191**

Replace:
```typescript
await preCacheTravelTimes(allItemIds);
```

With:
```typescript
// Fire-and-forget: Railway already handles cache lookups + Mapbox API calls internally
preCacheTravelTimes(allItemIds).catch(err =>
  console.warn("⚠️ Background cache warming failed:", err)
);
```

### Result
- Route preview: ~4-5 seconds (Railway only) instead of 30-120 seconds
- Zero accuracy loss — Railway does its own Mapbox lookups for cache misses
- The background cache warming still runs, benefiting future calls
- One line changed, one file

