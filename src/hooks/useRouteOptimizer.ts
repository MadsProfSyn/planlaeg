import { useState, useEffect, useCallback, useRef } from "react";
import type {
  RouteOptimizerAssignment,
  RouteOptimizerResponse,
  InspectorRoute,
  RouteOptimizerMetrics,
} from "@/types/route-optimizer";
import { supabase } from "@/integrations/supabase/client";

const ROUTE_OPTIMIZER_URL = "https://web-production-95fdd.up.railway.app";

// Pre-cache travel times between coordinates via Edge Function
async function preCacheTravelTimes(itemIds: number[]): Promise<void> {
  if (itemIds.length < 2) return;
  
  console.log("⏱️ Pre-caching travel times for", itemIds.length, "locations...");
  
  try {
    // Fetch coordinates from monday_items_selected
    const { data: items, error: fetchError } = await supabase
      .from("monday_items_selected")
      .select("id, lat, lng")
      .in("id", itemIds)
      .not("lat", "is", null)
      .not("lng", "is", null);
    
    if (fetchError) {
      console.warn("⚠️ Failed to fetch coordinates:", fetchError.message);
      return;
    }
    
    if (!items || items.length < 2) {
      console.log("⏭️ Not enough geocoded items to cache travel times");
      return;
    }
    
    console.log("📍 Found", items.length, "geocoded items, calling cache-travel-times...");
    
    const coordinates = items.map(i => ({
      id: String(i.id),
      lng: i.lng!,
      lat: i.lat!,
    }));
    
    const { data, error } = await supabase.functions.invoke("cache-travel-times", {
      body: { coordinates },
    });
    
    if (error) {
      console.warn("⚠️ cache-travel-times failed:", error.message);
      return;
    }
    
    console.log("✅ Travel times cached:", data?.stats || data);
  } catch (err) {
    console.warn("⚠️ Pre-cache travel times error:", err);
  }
}

interface MondayItemLike {
  id: number;
}

interface UseRouteOptimizerOptions {
  date: string;
  newAssignments: Map<string, MondayItemLike[]>;
  existingAssignments: Map<string, MondayItemLike[]>;
  enabled?: boolean;
  debounceMs?: number;
}

export function useRouteOptimizer({
  date,
  newAssignments,
  existingAssignments,
  enabled = true,
  debounceMs = 500,
}: UseRouteOptimizerOptions) {
  const [preview, setPreview] = useState<{
    routes: InspectorRoute[];
    metrics: RouteOptimizerMetrics | null;
    vrpRunId: string | null;
  }>({
    routes: [],
    metrics: null,
    vrpRunId: null,
  });
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Transform combined assignments (existing + new) to API format
  const transformAssignments = useCallback(
    (
      newMap: Map<string, MondayItemLike[]>,
      existingMap: Map<string, MondayItemLike[]>
    ): RouteOptimizerAssignment[] => {
      const result: RouteOptimizerAssignment[] = [];
      
      // Get all unique inspector IDs from both maps
      const allInspectorIds = new Set([...newMap.keys(), ...existingMap.keys()]);
      
      allInspectorIds.forEach((inspectorId) => {
        const newItems = newMap.get(inspectorId) || [];
        const existingItems = existingMap.get(inspectorId) || [];
        const allItems = [...existingItems, ...newItems];
        
        if (allItems.length > 0) {
          result.push({
            inspector_id: inspectorId,
            inspection_ids: allItems.map((item) => String(item.id)),
            existing_ids: existingItems.map((item) => String(item.id)),
          });
        }
      });
      
      return result;
    },
    []
  );

  // Check if there are any assignments (new or existing)
  const hasAnyAssignments = newAssignments.size > 0 || existingAssignments.size > 0;

  // Preview routes (no DB save)
  const fetchPreview = useCallback(async () => {
    if (!enabled || !hasAnyAssignments) {
      setPreview({ routes: [], metrics: null, vrpRunId: null });
      return;
    }

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsPreviewLoading(true);
    setError(null);

    try {
      const transformedAssignments = transformAssignments(newAssignments, existingAssignments);
      
      if (transformedAssignments.length === 0) {
        setPreview({ routes: [], metrics: null, vrpRunId: null });
        setIsPreviewLoading(false);
        return;
      }
      
      // Pre-cache travel times before calling Railway API (combine both existing and new)
      const allItemIds = [
        ...Array.from(newAssignments.values()).flat(),
        ...Array.from(existingAssignments.values()).flat(),
      ].map(item => item.id);
      await preCacheTravelTimes(allItemIds);
      
      const payload = {
        date,
        assignments: transformedAssignments,
      };

      console.log("🚗 Fetching route preview:", payload);

      const response = await fetch(`${ROUTE_OPTIMIZER_URL}/preview-routes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: RouteOptimizerResponse = await response.json();

      if (data.status === "error") {
        throw new Error(data.error || "Route optimization failed");
      }

      console.log("✅ Route preview received:", data);

      setPreview({
        routes: data.routes,
        metrics: data.metrics,
        vrpRunId: data.vrp_run_id || null,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return; // Ignore aborted requests
      }
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("❌ Route preview failed:", message);
      setError(message);
    } finally {
      setIsPreviewLoading(false);
    }
  }, [date, newAssignments, existingAssignments, hasAnyAssignments, enabled, transformAssignments]);

  // Debounced preview trigger
  useEffect(() => {
    if (!enabled) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchPreview();
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [fetchPreview, debounceMs, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Optimize routes (saves to DB)
  const optimizeRoutes = useCallback(async (): Promise<{
    success: boolean;
    vrpRunId?: string;
    error?: string;
  }> => {
    if (!hasAnyAssignments) {
      return { success: false, error: "No assignments to optimize" };
    }

    setIsOptimizing(true);
    setError(null);

    try {
      const transformedAssignments = transformAssignments(newAssignments, existingAssignments);
      
      if (transformedAssignments.length === 0) {
        return { success: false, error: "No assignments to optimize" };
      }
      
      const payload = {
        date,
        assignments: transformedAssignments,
      };

      console.log("💾 Optimizing and saving routes:", payload);

      const response = await fetch(`${ROUTE_OPTIMIZER_URL}/optimize-routes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: RouteOptimizerResponse = await response.json();

      if (data.status === "error") {
        throw new Error(data.error || "Route optimization failed");
      }

      console.log("✅ Routes optimized and saved:", data);

      // Update preview with final optimized routes
      setPreview({
        routes: data.routes,
        metrics: data.metrics,
        vrpRunId: data.vrp_run_id || null,
      });

      return { success: true, vrpRunId: data.vrp_run_id };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("❌ Route optimization failed:", message);
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsOptimizing(false);
    }
  }, [date, newAssignments, existingAssignments, hasAnyAssignments, transformAssignments]);

  // Get route for a specific inspector
  const getInspectorRoute = useCallback(
    (inspectorId: string): InspectorRoute | undefined => {
      return preview.routes.find((route) => route.inspector_id === inspectorId);
    },
    [preview.routes]
  );

  // Clear preview
  const clearPreview = useCallback(() => {
    setPreview({ routes: [], metrics: null, vrpRunId: null });
    setError(null);
  }, []);

  return {
    preview,
    isPreviewLoading,
    isOptimizing,
    error,
    optimizeRoutes,
    getInspectorRoute,
    clearPreview,
    refetchPreview: fetchPreview,
  };
}
