import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMondayItems, getRegions } from "@/lib/supabase";
import { PlanlaegSynFiltersBar } from "@/components/planlaeg-syn/PlanlaegSynFiltersBar";
import { InspectionsPanel } from "@/components/planlaeg-syn/InspectionsPanel";
import { InspectorsPanel } from "@/components/planlaeg-syn/InspectorsPanel";

export interface Inspector {
  availability_id: string;
  inspector_uuid: string;
  navn: string;
  afdeling: string;
  synstyper: string[];
  adresse: string;
  dato: string;
  start_tid: string | null;
  slut_tid: string | null;
  tidspunkt_label: string;
}

export default function PlanlaegSyn() {
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [selectedLandsdel, setSelectedLandsdel] = useState<string>("all");
  const [selectedInspectionIds, setSelectedInspectionIds] = useState<number[]>([]);
  const [selectedInspectorId, setSelectedInspectorId] = useState<string | null>(null);

  // Fetch regions for the filter dropdown
  const { data: regions = [] } = useQuery({
    queryKey: ["regions"],
    queryFn: getRegions,
  });

  // Fetch inspections for the selected date and region
  const { data: inspectionsData, isLoading: isLoadingInspections } = useQuery({
    queryKey: ["planlaeg-inspections", selectedDate, selectedLandsdel],
    queryFn: async () => {
      if (!selectedDate) return { data: [], count: 0 };
      
      const filters: { dateFrom?: string; dateTo?: string; regions?: string[] } = {
        dateFrom: selectedDate,
        dateTo: selectedDate,
      };
      
      if (selectedLandsdel !== "all") {
        filters.regions = [selectedLandsdel];
      }
      
      return getMondayItems(1, 500, filters);
    },
    enabled: !!selectedDate,
  });

  // Fetch inspectors for the selected date and region
  const { data: inspectorsData, isLoading: isLoadingInspectors } = useQuery({
    queryKey: ["planlaeg-inspectors", selectedDate, selectedLandsdel],
    queryFn: async () => {
      if (!selectedDate) return { data: [] };
      
      const params: any = {
        from: selectedDate,
        to: selectedDate,
        synstyper_all: true,
        synstyper: [],
        q: "",
        page: 1,
        pageSize: 500,
        no_pagination: true,
      };
      
      // Map landsdel to department filter if needed
      if (selectedLandsdel !== "all") {
        params.afdeling = [selectedLandsdel];
      }
      
      const { data, error } = await supabase.functions.invoke("fetch-available-inspectors", {
        body: params,
      });
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedDate,
  });

  const inspections = inspectionsData?.data || [];
  const inspectors: Inspector[] = inspectorsData?.data || [];

  const handleInspectionSelect = (id: number) => {
    setSelectedInspectionIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((i) => i !== id);
      }
      return [...prev, id];
    });
  };

  const handleInspectorSelect = (id: string) => {
    setSelectedInspectorId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Planlæg syn</h1>
        <p className="text-muted-foreground">Tildel synsopgaver til tilgængelige konsulenter</p>
      </div>

      <PlanlaegSynFiltersBar
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        selectedLandsdel={selectedLandsdel}
        onLandsdelChange={setSelectedLandsdel}
        regions={regions}
      />

      {!selectedDate ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Vælg en dato for at se synsopgaver og tilgængelige konsulenter
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0 mt-4">
          <InspectionsPanel
            inspections={inspections}
            isLoading={isLoadingInspections}
            selectedIds={selectedInspectionIds}
            onSelect={handleInspectionSelect}
          />
          <InspectorsPanel
            inspectors={inspectors}
            isLoading={isLoadingInspectors}
            selectedId={selectedInspectorId}
            onSelect={handleInspectorSelect}
          />
        </div>
      )}
    </div>
  );
}
