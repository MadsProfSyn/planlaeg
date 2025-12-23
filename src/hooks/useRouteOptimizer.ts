import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  RouteOptimizerAssignment,
  RouteOptimizerResponse,
  InspectorRoute,
  RouteOptimizerMetrics,
} from "@/types/route-optimizer";

const ROUTE_OPTIMIZER_URL = "https://web-production-95fdd.up.railway.app";

interface MondayItemLike {
  id: number;
  item_id: number | null; // Monday.com item ID
}

interface UseRouteOptimizerOptions {
  date: string;
  assignments: Map<string, MondayItemLike[]>;
  enabled?: boolean;
  debounceMs?: number;
}

// Lookup UUIDs from inspection_queue by Monday item IDs
async function lookupInspectionQueueUUIDs(
  mondayItemIds: number[]
): Promise<Map<number, string>> {
  const uuidMap = new Map<number, string>();
  
  if (mondayItemIds.length === 0) return uuidMap;
  
  console.log("🔍 Looking up UUIDs for Monday item IDs:", mondayItemIds);
  
  const { data, error } = await supabase
    .from("inspection_queue")
    .select("id, monday_item_id")
    .in("monday_item_id", mondayItemIds);
  
  if (error) {
    console.error("❌ Failed to lookup inspection_queue UUIDs:", error);
    return uuidMap;
  }
  
  data?.forEach((row) => {
    if (row.monday_item_id !== null) {
      uuidMap.set(row.monday_item_id, row.id);
    }
  });
  
  console.log("✅ UUID lookup result:", Object.fromEntries(uuidMap));
  return uuidMap;
}

export function useRouteOptimizer({
  date,
  assignments,
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

  // Transform assignments Map to API format with UUID lookup
  const transformAssignments = useCallback(
    async (assignmentsMap: Map<string, MondayItemLike[]>): Promise<RouteOptimizerAssignment[]> => {
      // Collect all unique Monday item IDs
      const allMondayItemIds: number[] = [];
      assignmentsMap.forEach((items) => {
        items.forEach((item) => {
          if (item.item_id !== null && item.item_id !== undefined) {
            allMondayItemIds.push(item.item_id);
          }
        });
      });
      
      // Lookup UUIDs from inspection_queue
      const uuidMap = await lookupInspectionQueueUUIDs(allMondayItemIds);
      
      const result: RouteOptimizerAssignment[] = [];
      
      assignmentsMap.forEach((items, inspectorId) => {
        if (items.length > 0) {
          const inspectionIds = items
            .map((item) => {
              if (item.item_id !== null && item.item_id !== undefined) {
                const uuid = uuidMap.get(item.item_id);
                if (!uuid) {
                  console.warn(`⚠️ No UUID found for Monday item ID: ${item.item_id}`);
                }
                return uuid;
              }
              return undefined;
            })
            .filter((id): id is string => id !== undefined);
          
          if (inspectionIds.length > 0) {
            result.push({
              inspector_id: inspectorId,
              inspection_ids: inspectionIds,
            });
          }
        }
      });
      
      return result;
    },
    []
  );

  // Preview routes (no DB save)
  const fetchPreview = useCallback(async () => {
    if (!enabled || assignments.size === 0) {
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
      // Await the async transform
      const transformedAssignments = await transformAssignments(assignments);
      
      if (transformedAssignments.length === 0) {
        console.warn("⚠️ No valid assignments after UUID lookup");
        setPreview({ routes: [], metrics: null, vrpRunId: null });
        setIsPreviewLoading(false);
        return;
      }
      
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
  }, [date, assignments, enabled, transformAssignments]);

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
    if (assignments.size === 0) {
      return { success: false, error: "No assignments to optimize" };
    }

    setIsOptimizing(true);
    setError(null);

    try {
      // Await the async transform
      const transformedAssignments = await transformAssignments(assignments);
      
      if (transformedAssignments.length === 0) {
        return { success: false, error: "No valid assignments after UUID lookup" };
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
  }, [date, assignments, transformAssignments]);

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
