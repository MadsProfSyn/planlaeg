import { useState, useEffect, useCallback, useRef } from "react";
import type {
  RouteOptimizerAssignment,
  RouteOptimizerResponse,
  InspectorRoute,
  RouteOptimizerMetrics,
} from "@/types/route-optimizer";

const ROUTE_OPTIMIZER_URL = "https://web-production-95fdd.up.railway.app";

interface MondayItemLike {
  id: number;
}

interface UseRouteOptimizerOptions {
  date: string;
  assignments: Map<string, MondayItemLike[]>;
  enabled?: boolean;
  debounceMs?: number;
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

  // Transform assignments Map to API format
  const transformAssignments = useCallback(
    (assignmentsMap: Map<string, MondayItemLike[]>): RouteOptimizerAssignment[] => {
      const result: RouteOptimizerAssignment[] = [];
      
      assignmentsMap.forEach((items, inspectorId) => {
        if (items.length > 0) {
          result.push({
            inspector_id: inspectorId,
            inspection_ids: items.map((item) => String(item.id)),
          });
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
      const payload = {
        date,
        assignments: transformAssignments(assignments),
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
      const payload = {
        date,
        assignments: transformAssignments(assignments),
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
