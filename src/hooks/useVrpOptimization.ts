import { useState, useEffect, useCallback } from "react";
import { computeVrpRoutes } from "@/lib/vrp";
import type { VrpRoutePlan } from "@/types/vrp";

interface UseVrpOptimizationOptions {
  inspectionIds: string[];
  targetDates: string[];
  enabled: boolean;
  debounceMs?: number;
}

export interface VrpProgress {
  stage: "idle" | "loading" | "computing" | "ready";
  percentage: number;
  message: string;
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
  const [progress, setProgress] = useState<VrpProgress>({
    stage: "idle",
    percentage: 0,
    message: "",
  });

  const fetchRoutes = useCallback(async () => {
    if (!enabled || inspectionIds.length === 0) {
      setProgress({ stage: "idle", percentage: 0, message: "" });
      return;
    }

    setIsLoading(true);
    setError(null);
    setProgress({
      stage: "loading",
      percentage: 20,
      message: "Indlæser syn data...",
    });

    try {
      // Simulate progress updates
      setTimeout(() => {
        setProgress({
          stage: "computing",
          percentage: 60,
          message: "Beregner optimale ruter...",
        });
      }, 500);

      const plan = await computeVrpRoutes(inspectionIds, targetDates);
      
      setProgress({
        stage: "ready",
        percentage: 100,
        message: "Klar til visning",
      });
      
      setRoutePlan(plan);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setRoutePlan(null);
      setProgress({ stage: "idle", percentage: 0, message: "" });
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
    progress,
  };
}
