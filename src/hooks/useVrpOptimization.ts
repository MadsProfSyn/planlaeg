import { useState, useEffect, useCallback } from "react";
import { computeVrpRoutes } from "@/lib/vrp";
import type { VrpRoutePlan } from "@/types/vrp";

interface UseVrpOptimizationOptions {
  inspectionIds: string[];
  targetDates: string[];
  enabled: boolean;
  debounceMs?: number;
}

export function useVrpOptimization({
  inspectionIds,
  targetDates,
  enabled,
  debounceMs = 200,
}: UseVrpOptimizationOptions) {
  const [routePlan, setRoutePlan] = useState<VrpRoutePlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRoutes = useCallback(async () => {
    if (!enabled || inspectionIds.length === 0) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const plan = await computeVrpRoutes(inspectionIds, targetDates);
      setRoutePlan(plan);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setRoutePlan(null);
    } finally {
      setIsLoading(false);
    }
  }, [inspectionIds, targetDates, enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const timeoutId = setTimeout(() => {
      fetchRoutes();
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [fetchRoutes, enabled, debounceMs]);

  const refetch = useCallback(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  return {
    routePlan,
    isLoading,
    error,
    refetch,
  };
}
