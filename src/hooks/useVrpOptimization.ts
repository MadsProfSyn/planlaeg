import { useState, useEffect, useCallback } from "react";
import { computeVrpRoutes, pollVrpJobStatus } from "@/lib/vrp";
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

  const fetchRoutes = useCallback(async () => {
    if (!enabled || inspectionIds.length === 0) {
      setProgress({ stage: "idle", percentage: 0, message: "" });
      return;
    }

    setIsLoading(true);
    setError(null);
    setJobId(null);
    setJobStatus(null);
    
    setProgress({
      stage: "loading",
      percentage: 20,
      message: "Starter ruteberegning...",
    });

    try {
      const result = await computeVrpRoutes(inspectionIds, targetDates);
      
      // Check if this is a completed job response (immediate completion)
      if ('job_id' in result && result.status === 'completed') {
        // Job completed immediately
        console.log('VRP job completed immediately:', result);
        
        if (result.summary) {
          // Show success toast with metrics
          toast({
            title: "Ruteberegning fuldført",
            description: `${result.summary.total_scheduled} syn planlagt. Total distance: ${result.summary.total_travel_km.toFixed(1)} km, tid: ${result.summary.total_travel_minutes} min.`,
          });
        }
        
        setProgress({
          stage: "ready",
          percentage: 100,
          message: "Klar til visning",
        });
        setIsLoading(false);
        return;
      }
      
      // Check if this is a job queue response
      if ('job_id' in result) {
        if (result.blocked) {
          setError("En anden VRP-beregning kører. Vent venligst.");
          setProgress({ stage: "idle", percentage: 0, message: "" });
          setIsLoading(false);
          return;
        }
        
        // Job queued - start polling
        setJobId(result.job_id);
        setJobStatus(result.status as any);
        setProgress({
          stage: "queued",
          percentage: 40,
          message: "Job sat i kø...",
          jobId: result.job_id,
        });
        // Don't set isLoading to false - polling will continue
      } else {
        // Immediate result (backwards compatible) - result is VrpRoutePlan
        if ('assignments' in result) {
          setRoutePlan(result);
          setProgress({
            stage: "ready",
            percentage: 100,
            message: "Klar til visning",
          });
        }
        setIsLoading(false);
      }
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

  // Poll for job status
  useEffect(() => {
    if (!jobId || jobStatus === 'completed' || jobStatus === 'failed') {
      return;
    }

    console.log('Starting poll for job:', jobId, 'status:', jobStatus);

    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await pollVrpJobStatus(jobId);
        console.log('Poll result:', statusResponse.status);
        
        setJobStatus(statusResponse.status);

        if (statusResponse.status === 'running') {
          setProgress({
            stage: "computing",
            percentage: statusResponse.progress || 70,
            message: "Beregner optimale ruter...",
            jobId,
          });
        }

        if (statusResponse.status === 'completed') {
          console.log('VRP job completed via polling:', statusResponse);
          
          // Check if we have the new format with summary
          if (statusResponse.summary) {
            // Show success toast with metrics
            toast({
              title: "Ruteberegning fuldført",
              description: `${statusResponse.summary.total_scheduled} syn planlagt. Total distance: ${statusResponse.summary.total_travel_km.toFixed(1)} km, tid: ${statusResponse.summary.total_travel_minutes} min.`,
            });
          }
          
          // Set route plan if available (backwards compatible)
          if (statusResponse.result) {
            setRoutePlan(statusResponse.result);
          }
          
          setProgress({
            stage: "ready",
            percentage: 100,
            message: "Klar til visning",
            jobId,
          });
          setIsLoading(false);
          clearInterval(pollInterval);
        }

        if (statusResponse.status === 'failed') {
          setError(statusResponse.error || "VRP job failed");
          setRoutePlan(null);
          setIsLoading(false);
          setProgress({ stage: "idle", percentage: 0, message: "" });
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error("Error polling job status:", error);
        // Don't stop polling on temporary network errors
      }
    }, 2000); // Poll every 2 seconds

    return () => {
      console.log('Clearing poll interval for job:', jobId);
      clearInterval(pollInterval);
    };
  }, [jobId, jobStatus]);

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
  };
}
