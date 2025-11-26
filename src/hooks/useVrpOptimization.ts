import { useState, useEffect, useCallback } from "react";
import { computeVrpRoutes, pollVrpJobStatus, fetchAssignmentsByVrpRunId } from "@/lib/vrp";
import type { VrpRoutePlan } from "@/types/vrp";
import { toast } from "@/hooks/use-toast";

interface UseVrpOptimizationOptions {
  inspectionIds: string[];
  targetDates: string[];
  enabled: boolean;
  debounceMs?: number;
}

export interface VrpProgress {
  stage: "idle" | "loading" | "queued" | "computing" | "ready";
  percentage: number;
  message: string;
  jobId?: string;
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
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<'pending' | 'running' | 'completed' | 'failed' | null>(null);
  const [vrpRunId, setVrpRunId] = useState<string | null>(null);

  const fetchRoutes = useCallback(async () => {
    if (!enabled || inspectionIds.length === 0) {
      setProgress({ stage: "idle", percentage: 0, message: "" });
      return;
    }

    setIsLoading(true);
    setError(null);
    setJobId(null);
    setJobStatus(null);
    setVrpRunId(null);
    
    setProgress({
      stage: "loading",
      percentage: 20,
      message: "Starter ruteberegning...",
    });

    try {
      const result = await computeVrpRoutes(inspectionIds, targetDates);
      
      console.log('VRP computation result:', result);
      
      // Type guard: result is always VrpComputeResponse from backend
      const response = result as any; // Backend now always returns VrpComputeResponse format
      
      // Check if computation was successful
      if (!response.success) {
        // Handle blocked/error cases
        if (response.blocked) {
          setError(`En anden VRP-beregning kører. Prøv igen om ${response.retry_after || 30} sekunder.`);
        } else {
          setError(response.error || "VRP-beregning fejlede");
        }
        setProgress({ stage: "idle", percentage: 0, message: "" });
        setIsLoading(false);
        return;
      }
      
      // Success - job completed (backend handled polling)
      if (response.status === 'completed' && response.vrp_run_id) {
        console.log('✅ VRP job completed:', {
          job_id: response.job_id,
          vrp_run_id: response.vrp_run_id,
          summary: response.summary,
        });
        
        // Store the vrp_run_id for explanation feature
        setVrpRunId(response.vrp_run_id);
        
        if (response.summary) {
          // Show success toast with metrics
          toast({
            title: "Ruteberegning fuldført",
            description: `${response.summary.total_scheduled} syn planlagt. Total distance: ${response.summary.total_travel_km.toFixed(1)} km, tid: ${response.summary.total_travel_minutes} min.`,
          });
        }
        
        // Fetch assignments from database using vrp_run_id
        try {
          const routePlanFromDb = await fetchAssignmentsByVrpRunId(response.vrp_run_id);
          setRoutePlan(routePlanFromDb);
          console.log('✅ Route plan loaded from database');
        } catch (error) {
          console.error('❌ Failed to fetch route plan from database:', error);
          setError('Kunne ikke hente rutedetaljer fra databasen');
        }
        
        setProgress({
          stage: "ready",
          percentage: 100,
          message: "Klar til visning",
        });
        setIsLoading(false);
        return;
      }
      
      // Unexpected response
      console.warn('⚠️ Unexpected VRP response format:', response);
      setError('Uventet svar fra VRP-tjenesten');
      setIsLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setRoutePlan(null);
      setProgress({ stage: "idle", percentage: 0, message: "" });
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
    jobId,
    jobStatus,
    vrpRunId,
  };
}
