import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMondayItems, getRegions, MondayItem } from "@/lib/supabase";
import { PlanlaegSynFiltersBar } from "@/components/planlaeg-syn/PlanlaegSynFiltersBar";
import { InspectionsPanel } from "@/components/planlaeg-syn/InspectionsPanel";
import { InspectorsPanel } from "@/components/planlaeg-syn/InspectorsPanel";
import { Button } from "@/components/ui/button";
import { Lock, CheckCircle } from "lucide-react";

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
  
  // Phase 2: Assignment state
  const [assignments, setAssignments] = useState<Map<string, MondayItem[]>>(new Map());
  const [isLocked, setIsLocked] = useState(false);

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

  // Compute assigned inspection IDs for filtering left panel when locked
  const assignedInspectionIds = useMemo(() => {
    const ids = new Set<number>();
    assignments.forEach((items) => {
      items.forEach((item) => ids.add(item.id));
    });
    return ids;
  }, [assignments]);

  // Total assignments count
  const totalAssignments = useMemo(() => {
    return Array.from(assignments.values()).reduce((acc, items) => acc + items.length, 0);
  }, [assignments]);

  // Check if any inspections are currently selected
  const hasSelectedInspections = selectedInspectionIds.length > 0;

  const handleInspectionSelect = (id: number) => {
    setSelectedInspectionIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((i) => i !== id);
      }
      return [...prev, id];
    });
  };

  const handleInspectorSelect = (inspectorId: string) => {
    // If inspections are selected, assign them to this inspector
    if (selectedInspectionIds.length > 0) {
      const inspectionsToAssign = inspections.filter(
        (insp) => selectedInspectionIds.includes(insp.id)
      );
      
      setAssignments((prev) => {
        const next = new Map(prev);
        const existing = next.get(inspectorId) || [];
        
        // Add new inspections (avoid duplicates)
        const existingIds = new Set(existing.map((i) => i.id));
        const newItems = inspectionsToAssign.filter((i) => !existingIds.has(i.id));
        
        // Also remove from other inspectors (each inspection can only be assigned to one)
        next.forEach((items, key) => {
          if (key !== inspectorId) {
            next.set(key, items.filter((item) => !selectedInspectionIds.includes(item.id)));
          }
        });
        
        next.set(inspectorId, [...existing, ...newItems]);
        return next;
      });
      
      // Clear selection after assignment
      setSelectedInspectionIds([]);
    } else {
      // No inspections selected - toggle inspector highlight
      setSelectedInspectorId((prev) => (prev === inspectorId ? null : inspectorId));
    }
  };

  const handleRemoveAssignment = (inspectorId: string, inspectionId: number) => {
    setAssignments((prev) => {
      const next = new Map(prev);
      const existing = next.get(inspectorId) || [];
      next.set(inspectorId, existing.filter((i) => i.id !== inspectionId));
      return next;
    });
  };

  const handleLockAssignments = () => {
    setIsLocked(true);
  };

  return (
    <div className="flex flex-col h-full px-6 lg:px-8">
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
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0 mt-4">
            <InspectionsPanel
              inspections={inspections}
              isLoading={isLoadingInspections}
              selectedIds={selectedInspectionIds}
              onSelect={handleInspectionSelect}
              hiddenIds={isLocked ? assignedInspectionIds : undefined}
              assignedIds={assignedInspectionIds}
            />
            <InspectorsPanel
              inspectors={inspectors}
              isLoading={isLoadingInspectors}
              selectedId={selectedInspectorId}
              onSelect={handleInspectorSelect}
              assignments={assignments}
              onRemoveAssignment={handleRemoveAssignment}
              hasSelectedInspections={hasSelectedInspections}
            />
          </div>

          {/* Sticky footer with lock button */}
          {totalAssignments > 0 && (
            <div className="sticky bottom-0 bg-background border-t py-4 mt-4 -mx-6 px-6 lg:-mx-8 lg:px-8">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {totalAssignments} inspektion{totalAssignments !== 1 ? "er" : ""} tildelt
                </span>
                <Button 
                  onClick={handleLockAssignments}
                  disabled={isLocked}
                  className="gap-2"
                >
                  {isLocked ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Inspektioner låst
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      Lås inspektioner
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
