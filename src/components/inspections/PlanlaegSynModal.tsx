import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, Clock, MapPin, User, AlertCircle, CheckCircle2, Loader2, Package, ChevronDown } from "lucide-react";
import { useVrpOptimization, type VrpProgress } from "@/hooks/useVrpOptimization";
import { Progress } from "@/components/ui/progress";
import { approveVrpAssignments, getInspectionsByIds, groupAssignmentsByInspector } from "@/lib/vrp";
import { useToast } from "@/hooks/use-toast";
import { InspectorRouteGroup } from "./InspectorRouteGroup";
import { RouteMapView } from "./RouteMapView";
import { SimpleFallbackMap } from "./SimpleFallbackMap";
import { InspectorSelectorWithFilters } from "./InspectorSelectorWithFilters";
import type { VrpAssignment } from "@/types/vrp";
import { ErrorBoundary } from "@/components/utility/ErrorBoundary";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { TEST_MODE } from "@/lib/testMode";
import { AlertTriangle } from "lucide-react";

type InspectorBase = {
  id: string;
  full_name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
};

interface PlanlaegSynModalProps {
  open: boolean;
  onClose: () => void;
  selectedInspectionIds: string[];
  onApproved: () => void;
}

export function PlanlaegSynModal({
  open,
  onClose,
  selectedInspectionIds,
  onApproved,
}: PlanlaegSynModalProps) {
  const { toast } = useToast();
  const [inspections, setInspections] = useState<any[]>([]);
  const [datetimeByInspection, setDatetimeByInspection] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingInspections, setLoadingInspections] = useState(false);
  const [selectedInspectorId, setSelectedInspectorId] = useState<string | null>(null);
  const [groupingError, setGroupingError] = useState<string | null>(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [inspectorBases, setInspectorBases] = useState<Map<string, InspectorBase>>(new Map());
  const [isFetchingBases, setIsFetchingBases] = useState(false);
  const [roundtripEnabled, setRoundtripEnabled] = useState(true);
  const mapSectionRef = useRef<HTMLDivElement | null>(null);
  
  // WorkFeed sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({
    total: 0,
    completed: 0,
    failed: 0,
  });
  const [currentSync, setCurrentSync] = useState<string | null>(null);
  
  // Manual inspector assignments (before VRP approval)
  const [manualAssignments, setManualAssignments] = useState<Record<string, {
    inspectorId: string;
    inspectorName: string;
  } | null>>({});
  const [inspectorSelectorOpen, setInspectorSelectorOpen] = useState(false);
  const [selectedInspectionForAssignment, setSelectedInspectionForAssignment] = useState<any | null>(null);

  // Extract unique target dates from inspections
  const targetDates = React.useMemo(() => {
    const dates = inspections
      .map((i) => i.preferred_date)
      .filter((d) => d);
    return Array.from(new Set(dates));
  }, [inspections]);

  // Use VRP optimization hook
  const {
    routePlan,
    isLoading: isLoadingRoutes,
    error: vrpError,
    refetch: refetchVrp,
    progress,
    jobId,
    jobStatus,
  } = useVrpOptimization({
    inspectionIds: selectedInspectionIds,
    targetDates,
    enabled: open && inspections.length > 0,
  });

  // Load inspection details when modal opens
  useEffect(() => {
    if (!open || selectedInspectionIds.length === 0) {
      return;
    }

    const loadInspections = async () => {
      setLoadingInspections(true);
      try {
        const data = await getInspectionsByIds(selectedInspectionIds);
        setInspections(data);

        // Initialize datetime inputs with preferred dates
        const initial: Record<string, string> = {};
        data.forEach((inspection) => {
          if (inspection.preferred_date) {
            // Format as datetime-local input value (YYYY-MM-DDTHH:mm)
            initial[inspection.id] = `${inspection.preferred_date}T09:00`;
          }
        });
        setDatetimeByInspection(initial);
      } catch (error) {
        toast({
          title: "Fejl",
          description: "Kunne ikke hente syn detaljer",
          variant: "destructive",
        });
      } finally {
        setLoadingInspections(false);
      }
    };

    loadInspections();
  }, [open, selectedInspectionIds, toast]);

  // Update datetime when VRP assignments are computed
  useEffect(() => {
    if (!routePlan?.assignments) return;

    const updated: Record<string, string> = { ...datetimeByInspection };
    routePlan.assignments.forEach((assignment) => {
      const datetime = assignment.scheduled_at || `${assignment.scheduled_date}T${assignment.start_time}`;
      updated[assignment.inspection_id] = datetime;
    });
    setDatetimeByInspection(updated);
  }, [routePlan]);

  const handleDatetimeChange = (inspectionId: string, value: string) => {
    setDatetimeByInspection((prev) => ({
      ...prev,
      [inspectionId]: value,
    }));
  };

  const handleApprove = async () => {
    // Validation
    const missingDatetime = inspections.filter(
      (inspection) => !datetimeByInspection[inspection.id]
    );

    if (missingDatetime.length > 0) {
      toast({
        title: "Manglende information",
        description: "Angiv dato og tidspunkt for alle syn",
        variant: "destructive",
      });
      return;
    }

    if (!routePlan?.assignments || routePlan.assignments.length === 0) {
      toast({
        title: "Ingen rute beregnet",
        description: "Vent på ruteberegning eller prøv igen",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create assignments from route plan with user-edited datetimes
      // Merge manual assignments with VRP assignments
      const assignments: VrpAssignment[] = routePlan.assignments.map((assignment) => {
        const manualAssignment = manualAssignments[assignment.inspection_id];
        const userDatetime = datetimeByInspection[assignment.inspection_id];
        const [date, time] = userDatetime.split("T");
        
        if (manualAssignment) {
          // Use manual assignment
          return {
            ...assignment,
            inspector_id: manualAssignment.inspectorId,
            inspector_name: manualAssignment.inspectorName,
            scheduled_date: date,
            start_time: time,
            assignment_source: 'manual',
          };
        } else {
          // Use VRP assignment
          return {
            ...assignment,
            scheduled_date: date,
            start_time: time,
            assignment_source: 'vrp',
          };
        }
      });

      const vrpRunId = crypto.randomUUID();

      const response = await approveVrpAssignments({
        vrp_run_id: vrpRunId,
        assignments,
        inspection_ids: selectedInspectionIds,
      });

      // Check if we got shift IDs back
      if (!response.shift_ids || response.shift_ids.length === 0) {
        toast({
          title: "Syn planlagt",
          description: `${response.approved_count} syn blev planlagt (ingen vagter at synkronisere)`,
        });
        onApproved();
        onClose();
        return;
      }

      // 2. Sync shifts to WorkFeed
      setIsSyncing(true);
      setSyncProgress({
        total: response.shift_ids.length,
        completed: 0,
        failed: 0,
      });

      const syncResults = [];
      
      for (let i = 0; i < response.shift_ids.length; i++) {
        const shiftId = response.shift_ids[i];
        
        setCurrentSync(`Synkroniserer vagt ${i + 1} af ${response.shift_ids.length}...`);
        
        try {
          const syncResponse = await supabase.functions.invoke("post-to-workfeed", {
            body: { shiftId },
          });

          if (syncResponse.data?.success) {
            syncResults.push({ shiftId, status: "success" });
            setSyncProgress((prev) => ({
              ...prev,
              completed: prev.completed + 1,
            }));
          } else {
            throw new Error(syncResponse.data?.error || syncResponse.error?.message || "Sync failed");
          }
        } catch (error) {
          console.error(`Failed to sync shift ${shiftId}:`, error);
          syncResults.push({
            shiftId,
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
          });
          setSyncProgress((prev) => ({
            ...prev,
            failed: prev.failed + 1,
          }));
        }
      }

      // 3. Show results
      const successCount = syncResults.filter((r) => r.status === "success").length;
      const failedCount = syncResults.filter((r) => r.status === "failed").length;

      if (failedCount === 0) {
        toast({
          title: "Syn planlagt og synkroniseret",
          description: `✅ ${successCount} vagter er oprettet i WorkFeed`,
        });
      } else {
        toast({
          title: "Delvis synkronisering",
          description: `✅ ${successCount} synkroniseret • ⚠️ ${failedCount} fejlede`,
          variant: "default",
        });
      }

      onApproved();
      onClose();
    } catch (error) {
      toast({
        title: "Fejl",
        description: error instanceof Error ? error.message : "Kunne ikke planlægge syn",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setIsSyncing(false);
      setCurrentSync(null);
    }
  };

  const openInspectorSelector = (inspection: any) => {
    setSelectedInspectionForAssignment(inspection);
    setInspectorSelectorOpen(true);
  };

  const handleInspectorSelect = (inspectorId: string | null, inspectorName: string | null) => {
    if (!selectedInspectionForAssignment) return;
    
    if (inspectorId && inspectorName) {
      setManualAssignments(prev => ({
        ...prev,
        [selectedInspectionForAssignment.id]: {
          inspectorId,
          inspectorName
        }
      }));
      
      toast({
        title: "Inspektør valgt",
        description: `${inspectorName} er valgt til dette syn`,
      });
    } else {
      // Clear manual assignment (use VRP)
      setManualAssignments(prev => {
        const updated = { ...prev };
        delete updated[selectedInspectionForAssignment.id];
        return updated;
      });
      
      toast({
        title: "Automatisk tildeling",
        description: "VRP vil tildele en inspektør automatisk",
      });
    }
  };

  const clearManualAssignment = (inspectionId: string) => {
    setManualAssignments(prev => {
      const updated = { ...prev };
      delete updated[inspectionId];
      return updated;
    });
    
    toast({
      title: "Tildeling fjernet",
      description: "VRP vil tildele en inspektør automatisk",
    });
  };

  const hasMissingData = inspections.some(
    (inspection) => !datetimeByInspection[inspection.id]
  );

  // Group assignments by inspector (bulletproof)
  const groupedRoutes = React.useMemo(() => {
    try {
      setGroupingError(null);
      if (!routePlan) return null;
      
      console.log('🔄 Recalculating groupedRoutes:', {
        roundtripEnabled,
        basesCount: inspectorBases.size,
        inspectionsCount: inspections.length
      });
      
      const result = groupAssignmentsByInspector(routePlan, inspections, inspectorBases, roundtripEnabled);
      
      console.log('✅ Grouped routes:', {
        routesCount: result.inspector_routes.length,
        firstRoute: result.inspector_routes[0] ? {
          inspector: result.inspector_routes[0].inspector_name,
          baseAddress: result.inspector_routes[0].base_address,
          regularDistance: result.inspector_routes[0].total_distance_km,
          roundtripDistance: result.inspector_routes[0].roundtrip_distance_km
        } : null
      });
      
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("groupAssignmentsByInspector failed:", e);
      setGroupingError(msg);
      // Minimal fallback from assignments only
      const assignments = routePlan?.assignments ?? [];
      const grouped = new Map<string, typeof assignments>();
      assignments.forEach((a) => {
        const arr = grouped.get(a.inspector_id) ?? [];
        grouped.set(a.inspector_id, [...arr, a]);
      });
      const inspector_routes = Array.from(grouped.entries()).map(([inspector_id, arr]) => {
        const sorted = arr.slice().sort((a, b) => a.sequence_in_route - b.sequence_in_route);
        const total_inspection_mins = sorted.length * 60;
        return {
          inspector_id,
          inspector_name: sorted[0]?.inspector_name || "Ukendt",
          assignments: sorted,
          total_time_mins: total_inspection_mins,
          total_distance_km: 0,
          total_inspections: sorted.length,
        };
      });
      const assignedIds = new Set(assignments.map((a) => a.inspection_id));
      const unassigned_inspections = inspections.filter((i) => !assignedIds.has(i.id));
      return {
        inspector_routes,
        unassigned_inspections,
        overall_total_time: (routePlan?.total_eta_minutes ?? inspector_routes.reduce((s, r) => s + r.total_time_mins, 0)),
        overall_total_distance: (routePlan?.total_distance_km ?? 0),
      };
    }
  }, [routePlan, inspections, inspectorBases, roundtripEnabled]);

  // Create inspection map for quick lookup
  const inspectionsMap = React.useMemo(() => {
    return new Map(inspections.map((i) => [i.id, i]));
  }, [inspections]);

  // Fetch inspector base addresses for map
  useEffect(() => {
    if (!routePlan?.assignments) return;
    
    // Extract unique inspector IDs from assignments
    const ids = Array.from(new Set(routePlan.assignments.map(a => a.inspector_id)));
    if (ids.length === 0) return;

    let isCancelled = false;
    (async () => {
      setIsFetchingBases(true);
      const { data, error } = await supabase
        .from("inspectors")
        .select("id, full_name, address, lat, lng")
        .in("id", ids);

      if (!isCancelled) {
        if (error) {
          console.error("Failed to fetch inspector bases", error);
          setInspectorBases(new Map());
        } else {
          const m = new Map<string, InspectorBase>();
          (data || []).forEach((row) => m.set(row.id, row));
          setInspectorBases(m);
        }
        setIsFetchingBases(false);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [routePlan]);

  // Auto-open map on large screens when routes are ready
  useEffect(() => {
    if (groupedRoutes && !isMapExpanded && typeof window !== "undefined" && window.innerWidth >= 1280) {
      setIsMapExpanded(true);
    }
  }, [groupedRoutes, isMapExpanded]);

  return (
    <ErrorBoundary name="PlanlaegSynModal">
      <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              Planlæg syn ({selectedInspectionIds.length} valgt)
            </DialogTitle>
          </DialogHeader>

          {/* TEST MODE WARNING */}
          {TEST_MODE && (
            <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950 dark:border-orange-700">
              <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <AlertDescription className="text-orange-900 dark:text-orange-100">
                <strong>TEST MODE AKTIV</strong> - Kun test-inspektører (Albert, Mads, Jobson) kan bruges.
                Sæt <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded text-xs">TEST_MODE = false</code> i <code className="text-xs">src/lib/testMode.ts</code> for at bruge alle inspektører.
              </AlertDescription>
            </Alert>
          )}

        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 h-full">
            {/* Left Panel: Inspection Details */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Detaljer pr. syn
              </h3>

              <ScrollArea className="h-[calc(100vh-280px)] max-h-[800px] pr-4">
                {loadingInspections ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-32 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {inspections.map((inspection, index) => {
                      const assignment = routePlan?.assignments.find(
                        (a) => a.inspection_id === inspection.id
                      );

                      return (
                        <div
                          key={inspection.id}
                          className="border rounded-lg p-4 space-y-3 bg-card"
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">#{index + 1}</Badge>
                                <Badge>{inspection.inspection_type}</Badge>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="h-4 w-4" />
                                {inspection.address}
                              </div>
                            </div>
                          </div>

                          {/* Manual or VRP Assignment Display */}
                          <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                            {manualAssignments[inspection.id] ? (
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-blue-600" />
                                  <span className="font-medium text-sm">
                                    {manualAssignments[inspection.id].inspectorName}
                                  </span>
                                  <Badge 
                                    variant="secondary" 
                                    className="bg-blue-500/10 text-blue-700 border-blue-500/20"
                                  >
                                    Manuelt valgt
                                  </Badge>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openInspectorSelector(inspection)}
                                  >
                                    Ændre
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => clearManualAssignment(inspection.id)}
                                  >
                                    Fjern
                                  </Button>
                                </div>
                              </div>
                            ) : assignment ? (
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-primary" />
                                  <span className="text-sm">
                                    {assignment.inspector_name}
                                  </span>
                                  <Badge 
                                    variant="secondary" 
                                    className="bg-green-500/10 text-green-700 border-green-500/20"
                                  >
                                    VRP planlagt
                                  </Badge>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openInspectorSelector(inspection)}
                                >
                                  Vælg inspektør
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">
                                  {isLoadingRoutes ? "Beregner..." : "VRP tildeler automatisk"}
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openInspectorSelector(inspection)}
                                  disabled={isLoadingRoutes}
                                >
                                  Vælg inspektør
                                </Button>
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`datetime-${inspection.id}`}>
                              Dato + tidspunkt
                            </Label>
                            <Input
                              id={`datetime-${inspection.id}`}
                              type="datetime-local"
                              value={datetimeByInspection[inspection.id] || ""}
                              onChange={(e) =>
                                handleDatetimeChange(inspection.id, e.target.value)
                              }
                              className="w-full"
                            />
                            {!datetimeByInspection[inspection.id] && (
                              <p className="text-sm text-destructive flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Angiv dato og tidspunkt
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Right Panel: Route Overview */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Ruteoversigt
              </h3>

              {isLoadingRoutes ? (
                <div className="space-y-4">
                  {/* Enhanced Progress Indicator with Job Status */}
                  <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm font-medium">
                        {progress.stage === 'loading' && 'Starter beregning...'}
                        {progress.stage === 'queued' && 'Job i kø...'}
                        {progress.stage === 'computing' && 'Beregner ruter...'}
                      </span>
                      {jobId && (
                        <Badge variant="outline" className="text-xs ml-auto">
                          Job: {jobId.slice(0, 8)}...
                        </Badge>
                      )}
                    </div>
                    <Progress value={progress.percentage} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{progress.message}</span>
                      {jobStatus && (
                        <Badge variant="secondary" className="text-xs">
                          {jobStatus}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : vrpError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Kunne ikke hente rute. Prøv igen.
                    <br />
                    <span className="text-xs">{vrpError}</span>
                  </AlertDescription>
                </Alert>
              ) : groupedRoutes ? (
                <>
                  {/* Overall Stats */}
                  <div className="bg-primary/10 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4" />
                      <span className="font-medium">Estimeret tid:</span>
                      <span>{groupedRoutes.overall_total_time} min</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4" />
                      <span className="font-medium">Distance:</span>
                      <span>{Number(groupedRoutes.overall_total_distance ?? 0).toFixed(1)} km</span>
                    </div>
                  </div>

                  <ScrollArea className="h-[calc(100vh-280px)] max-h-[800px] pr-4">
                    <div className="space-y-4">
                      <h4 className="font-medium text-sm text-muted-foreground">
                        Optimeret rute:
                      </h4>

                      {/* Grouped by Inspector */}
                      {groupedRoutes.inspector_routes.map((inspectorRoute) => (
                        <InspectorRouteGroup
                          key={inspectorRoute.inspector_id}
                          inspectorRoute={inspectorRoute}
                          inspectionsMap={inspectionsMap}
                          isSelected={selectedInspectorId === inspectorRoute.inspector_id}
                          onSelect={() => setSelectedInspectorId(inspectorRoute.inspector_id)}
                          roundtripEnabled={roundtripEnabled}
                        />
                      ))}

                      {/* Unassigned Inspections */}
                      {groupedRoutes.unassigned_inspections.length > 0 && (
                        <div className="border-t pt-4 mt-4">
                          <h4 className="font-medium text-sm text-muted-foreground mb-3 flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Ikke tildelt ({groupedRoutes.unassigned_inspections.length})
                          </h4>
                          <div className="space-y-2">
                            {groupedRoutes.unassigned_inspections.map((inspection) => (
                              <div
                                key={inspection.id}
                                className="p-3 border rounded-lg bg-muted/50"
                              >
                                <div className="text-sm font-medium">
                                  {inspection.address}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {inspection.inspection_type}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Venter på ruteberegning...
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Third Panel: Map View */}
            <div className="space-y-4 hidden xl:block">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Kortvisning
                </h3>
                {groupedRoutes && (
                  <Button
                    size="sm"
                    variant={isMapExpanded ? "secondary" : "default"}
                    onClick={() => {
                      setIsMapExpanded((v) => !v);
                      setTimeout(() => mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
                    }}
                  >
                    {isMapExpanded ? "Skjul interaktivt kort" : "Vis interaktivt kort"}
                  </Button>
                )}
              </div>

              <ScrollArea className="h-[calc(100vh-280px)] max-h-[800px] pr-4">
                <div className="space-y-2">
                {/* Debug Info */}
                <details className="text-xs text-muted-foreground p-2 bg-muted/50 rounded">
                  <summary className="cursor-pointer font-medium">
                    Debug info (klik for detaljer)
                  </summary>
                  <div className="mt-2 space-y-1">
                    <div>Loading: {isLoadingRoutes ? 'Ja' : 'Nej'}</div>
                    <div>Error: {vrpError ? 'Ja' : 'Nej'}</div>
                    <div>GroupedRoutes: {groupedRoutes ? 'Ja' : 'Nej'}</div>
                    <div>Routes: {groupedRoutes?.inspector_routes?.length || 0}</div>
                    <div>Inspections: {inspections.length}</div>
                  </div>
                </details>

                {isLoadingRoutes && (
                  <Skeleton className="h-[600px] w-full rounded-lg" />
                )}

                {!isLoadingRoutes && vrpError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Kort kan ikke vises: {vrpError}
                    </AlertDescription>
                  </Alert>
                )}

                {!isLoadingRoutes && !vrpError && !groupedRoutes && (
                  <div className="h-[600px] border rounded-lg bg-muted/20 flex items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                      <p className="text-muted-foreground">Venter på ruteoversigt...</p>
                    </div>
                  </div>
                )}

                {!isLoadingRoutes && !vrpError && groupedRoutes && (
                  <div className="space-y-4">
                    {/* Anchor for smooth scroll */}
                    <div ref={mapSectionRef} />
                    
                    {/* Optional: Interactive map view */}
                    {isMapExpanded && (
                      <div className="mb-4">
                        <RouteMapView
                          key="interactive-map"
                          inspectorRoutes={groupedRoutes.inspector_routes}
                          selectedInspectorId={selectedInspectorId}
                          inspectionsMap={inspectionsMap}
                          onInspectorSelect={setSelectedInspectorId}
                          inspectorBases={inspectorBases}
                          roundtrip={roundtripEnabled}
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-3 pt-2">
                      <label className="text-sm flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={roundtripEnabled}
                          onChange={(e) => setRoundtripEnabled(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        Inkludér retur til base
                      </label>
                      {isFetchingBases && (
                        <span className="text-xs text-muted-foreground">Henter base-adresser…</span>
                      )}
                    </div>
                    
                    {/* Primary: Always visible list view */}
                    <SimpleFallbackMap
                      inspectorRoutes={groupedRoutes.inspector_routes}
                      selectedInspectorId={selectedInspectorId}
                      inspectionsMap={inspectionsMap}
                      onInspectorSelect={setSelectedInspectorId}
                    />
                  </div>
                )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2">
          {/* Progress indicator */}
          {isSyncing && syncProgress.total > 0 && (
            <div className="space-y-2 w-full">
              <Progress 
                value={(syncProgress.completed + syncProgress.failed) / syncProgress.total * 100} 
                className="h-2"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  ✅ {syncProgress.completed} synkroniseret
                  {syncProgress.failed > 0 && (
                    <span className="text-orange-600 dark:text-orange-400 ml-2">
                      ⚠️ {syncProgress.failed} fejlede
                    </span>
                  )}
                </span>
                <span>
                  {Math.round((syncProgress.completed + syncProgress.failed) / syncProgress.total * 100)}%
                </span>
              </div>
            </div>
          )}
          
          <div className="flex w-full justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline" disabled={isSubmitting || isSyncing}>
                Annullér
              </Button>
            </DialogClose>
            <Button
              onClick={handleApprove}
              disabled={hasMissingData || isSubmitting || isSyncing || !routePlan}
            >
              {isSubmitting || isSyncing ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    {isSyncing 
                      ? currentSync || "Synkroniserer..." 
                      : "Planlægger..."
                    }
                  </span>
                  {syncProgress.total > 0 && (
                    <span className="text-xs ml-1">
                      ({syncProgress.completed + syncProgress.failed}/{syncProgress.total})
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Godkend syn
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inspector Selector Modal */}
      {selectedInspectionForAssignment && (
        <InspectorSelectorWithFilters
          open={inspectorSelectorOpen}
          onOpenChange={setInspectorSelectorOpen}
          inspectionType={selectedInspectionForAssignment.inspection_type}
          preferredDate={selectedInspectionForAssignment.preferred_date}
          onSelect={handleInspectorSelect}
          currentSelection={manualAssignments[selectedInspectionForAssignment.id] || undefined}
        />
      )}
    </ErrorBoundary>
  );
}
