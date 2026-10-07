import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InspectorWarning {
  inspector_id: string;
  full_name: string;
  department: string | null;
  available_days_ahead: number | null;
  warning: string;
  label: string;
  priority: number;
}

export function useInspectorWarnings() {
  const query = useQuery({
    queryKey: ["inspector-warnings"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("inspector_warnings")
        .select("*")
        .order("priority", { ascending: true })
        .order("available_days_ahead", { ascending: false })
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data || []) as InspectorWarning[];
    },
  });

  const warnings = query.data ?? [];
  const inspectorCount = useMemo(
    () => new Set(warnings.map((w) => w.inspector_id)).size,
    [warnings]
  );

  return { ...query, warnings, inspectorCount };
}
