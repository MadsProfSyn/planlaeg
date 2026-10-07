import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SystemStatusLevel = "ok" | "warn" | "error";

export interface SystemStatusRow {
  key: string;
  sort_order: number | null;
  label: string;
  last_at: string | null;
  status: SystemStatusLevel;
  detail: string | null;
}

const ROUTE_OPTIMIZER_HEALTH_URL = "https://web-production-95fdd.up.railway.app/health";

export function useSystemStatus() {
  const viewQuery = useQuery({
    queryKey: ["system-status"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("system_status")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as SystemStatusRow[];
    },
  });

  const healthQuery = useQuery({
    queryKey: ["route-optimizer-health"],
    refetchInterval: 60_000,
    retry: false,
    queryFn: async (): Promise<SystemStatusRow> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(ROUTE_OPTIMIZER_HEALTH_URL, { signal: controller.signal });
        const json = res.ok ? await res.json() : null;
        const ok = json?.status === "healthy";
        return {
          key: "route_optimizer",
          sort_order: null,
          label: "Ruteberegning (Railway)",
          status: ok ? "ok" : "error",
          last_at: json?.last_request || null,
          detail: ok ? "Kører" : "Svarer ikke – ruteforslag i Planlæg syn virker ikke",
        };
      } catch {
        return {
          key: "route_optimizer",
          sort_order: null,
          label: "Ruteberegning (Railway)",
          status: "error",
          last_at: null,
          detail: "Svarer ikke – ruteforslag i Planlæg syn virker ikke",
        };
      } finally {
        clearTimeout(timer);
      }
    },
  });

  const rows = useMemo(() => {
    const r = [...(viewQuery.data ?? [])];
    if (healthQuery.data) r.push(healthQuery.data);
    return r;
  }, [viewQuery.data, healthQuery.data]);

  const worstStatus: SystemStatusLevel = rows.some((r) => r.status === "error")
    ? "error"
    : rows.some((r) => r.status === "warn")
      ? "warn"
      : "ok";

  const refetch = () => Promise.all([viewQuery.refetch(), healthQuery.refetch()]);

  return {
    rows,
    worstStatus,
    isLoading: viewQuery.isLoading || healthQuery.isLoading,
    isFetching: viewQuery.isFetching || healthQuery.isFetching,
    dataUpdatedAt: Math.max(viewQuery.dataUpdatedAt, healthQuery.dataUpdatedAt),
    refetch,
  };
}
