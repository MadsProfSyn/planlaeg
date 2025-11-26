import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import ReactMarkdown from "react-markdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, Clock, MapPin, User, AlertCircle, CheckCircle2, Loader2, Package, ChevronDown, X } from "lucide-react";
import { useVrpOptimization, type VrpProgress } from "@/hooks/useVrpOptimization";
import { Progress } from "@/components/ui/progress";
import { approveVrpAssignments, getInspectionsByIds, groupAssignmentsByInspector } from "@/lib/vrp";
import { useToast } from "@/hooks/use-toast";
import { sendBatchToZapier, type ZapierSynPayload } from "@/lib/zapier";
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
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [inspectorBases, setInspectorBases] = useState<Map<string, InspectorBase>>(new Map());
  const [isFetchingBases, setIsFetchingBases] = useState(false);
  const [roundtripEnabled, setRoundtripEnabled] = useState(true);
  const mapButtonRef = useRef<HTMLButtonElement>(null);
  
  // Exit confirmation state
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);
  
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
    vrpRunId,
  } = useVrpOptimization({
    inspectionIds: selectedInspectionIds,
    targetDates,
    enabled: open && inspections.length > 0,
  });

  // Explanation modal state
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);
  const [explanationText, setExplanationText] = useState<string | null>(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);

  // Check if VRP results exist
  const hasVrpResults = routePlan && routePlan.assignments && routePlan.assignments.length > 0;

  // Fetch AI explanation from vrp_runs table
  const fetchExplanation = async () => {
    if (!vrpRunId) return;
    setIsLoadingExplanation(true);
    setIsExplanationOpen(true);
    
    try {
      const { data, error } = await supabase
        .from('vrp_runs')
        .select('ai_explanation')
        .eq('id', vrpRunId)
        .single();
      
      if (error) throw error;
      setExplanationText(data?.ai_explanation || null);
    } catch (error) {
      console.error('Failed to fetch explanation:', error);
      setExplanationText(null);
    } finally {
      setIsLoadingExplanation(false);
    }
  };

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

      // 2. Send to Zapier webhook (ALWAYS happens, regardless of WorkFeed)
      console.log("[Godkend] Sending data to Zapier webhook...");
      console.log("[Godkend] Available inspections data:", inspections);
      console.log("[Godkend] Assignments to send:", assignments);
      
      try {
        // Build payloads for each assignment
        const zapierPayloads: ZapierSynPayload[] = assignments.map((assignment) => {
          const inspection = inspections.find(i => i.id === assignment.inspection_id);
          
          console.log(`[Zapier] Building payload for inspection ${assignment.inspection_id}:`, {
            found: !!inspection,
            inspection_data: inspection,
            assignment_data: assignment
          });
          
          // Combine scheduled_date and start_time into ISO8601 timestamps
          const startDateTime = new Date(`${assignment.scheduled_date}T${assignment.start_time}`);
          const endDateTime = new Date(`${assignment.scheduled_date}T${assignment.end_time}`);
          
          const payload = {
            // Identification
            inspection_id: assignment.inspection_id,
            monday_item_id: inspection?.monday_item_id || null,
            
            // Inspector
            inspector_id: assignment.inspector_id,
            inspector_name: assignment.inspector_name,
            
            // Scheduling (ISO8601 format)
            scheduled_date: assignment.scheduled_date,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            
            // Inspection details
            inspection_type: assignment.inspection_type || inspection?.inspection_type || "",
            address: assignment.inspection_address || inspection?.address || "",
            customer_name: inspection?.customer_name || null,
            department: inspection?.department || "",
            rooms: inspection?.rooms || 0,
            lease_number: inspection?.lease_number || null,
            
            // Metadata
            approved_at: new Date().toISOString(),
            vrp_run_id: vrpRunId,
          };
          
          console.log(`[Zapier] Payload for ${assignment.inspection_id}:`, JSON.stringify(payload, null, 2));
          return payload;
        });
        
        console.log("[Zapier] Total payloads to send:", zapierPayloads.length);
        console.log("[Zapier] Complete batch:", JSON.stringify(zapierPayloads, null, 2));
        
        // Send batch to Zapier (runs with retries)
        const zapierResult = await sendBatchToZapier(zapierPayloads);
        
        if (zapierResult.success === zapierPayloads.length) {
          toast({
            title: "Monday.com opdateret",
            description: `✅ ${zapierResult.success} syn synkroniseret`,
            duration: 3000,
          });
        } else if (zapierResult.success > 0) {
          toast({
            title: "Delvis Monday.com opdatering",
            description: `✅ ${zapierResult.success} opdateret • ⚠️ ${zapierResult.failed} afventer`,
            duration: 3000,
          });
        } else {
          toast({
            title: "Monday.com afventer",
            description: "Synene er godkendt, men Monday.com kunne ikke opdateres endnu.",
            duration: 3000,
          });
        }
      } catch (zapierError) {
        console.error("[Godkend] Zapier webhook error:", zapierError);
        toast({
          title: "Monday.com afventer",
          description: "Synene er godkendt, men Monday.com kunne ikke opdateres endnu.",
          duration: 3000,
        });
      }

      // 3. Check if we got shift IDs back
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

      // 4. Send to Zapier webhook
      console.log("[Godkend] Sending data to Zapier webhook...");
      
      try {
        // Build payloads for each assignment
        const zapierPayloads: ZapierSynPayload[] = assignments.map((assignment) => {
          const inspection = inspections.find(i => i.id === assignment.inspection_id);
          
          // Combine scheduled_date and start_time into ISO8601 timestamps
          const startDateTime = new Date(`${assignment.scheduled_date}T${assignment.start_time}`);
          const endDateTime = new Date(`${assignment.scheduled_date}T${assignment.end_time}`);
          
          return {
            // Identification
            inspection_id: assignment.inspection_id,
            monday_item_id: inspection?.monday_item_id || null,
            
            // Inspector
            inspector_id: assignment.inspector_id,
            inspector_name: assignment.inspector_name,
            
            // Scheduling (ISO8601 format)
            scheduled_date: assignment.scheduled_date,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            
            // Inspection details
            inspection_type: assignment.inspection_type || inspection?.inspection_type || "",
            address: assignment.inspection_address || inspection?.address || "",
            customer_name: inspection?.customer_name || null,
            department: inspection?.department || "",
            rooms: inspection?.rooms || 0,
            lease_number: inspection?.lease_number || null,
            
            // Metadata
            approved_at: new Date().toISOString(),
            vrp_run_id: vrpRunId,
          };
        });
        
        // Send batch to Zapier (runs with retries)
        const zapierResult = await sendBatchToZapier(zapierPayloads);
        
        if (zapierResult.success === zapierPayloads.length) {
          // All webhooks successful
          toast({
            title: "Syn godkendt og opdateret",
            description: `✅ ${zapierResult.success} syn synkroniseret til Monday.com`,
            duration: 4000,
          });
        } else if (zapierResult.success > 0) {
          // Partial success
          toast({
            title: "Syn godkendt",
            description: `✅ ${zapierResult.success} opdateret • ⚠️ ${zapierResult.failed} afventer`,
            variant: "default",
            duration: 4000,
          });
        } else {
          // All failed (but don't block user)
          toast({
            title: "Syn godkendt lokalt – afventer integration",
            description: "Monday.com opdatering vil blive forsøgt igen.",
            variant: "default",
            duration: 4000,
          });
        }
      } catch (zapierError) {
        console.error("[Godkend] Zapier webhook error:", zapierError);
        // Non-blocking warning
        toast({
          title: "Syn godkendt lokalt – afventer integration",
          description: "Synene er godkendt, men Monday.com kunne ikke opdateres.",
          variant: "default",
          duration: 4000,
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

  // Handle close with confirmation if VRP results exist
  const handleCloseAttempt = () => {
    if (hasVrpResults && !isSubmitting && !isSyncing) {
      setShowExitConfirmation(true);
      setPendingClose(true);
    } else {
      onClose();
    }
  };

  const handleConfirmExit = () => {
    setShowExitConfirmation(false);
    setPendingClose(false);
    onClose();
  };

  const handleCancelExit = () => {
    setShowExitConfirmation(false);
    setPendingClose(false);
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


  return (
    <ErrorBoundary name="PlanlaegSynModal">
      <Dialog open={open} onOpenChange={(open) => !open && handleCloseAttempt()}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-2xl">
                Planlæg syn ({selectedInspectionIds.length} valgt{groupedRoutes ? `, ${groupedRoutes.inspector_routes.reduce((sum, r) => sum + r.assignments.length, 0)} planlagt` : ''})
              </DialogTitle>
              
              {groupedRoutes && !isLoadingRoutes && (
                <div className="flex items-center gap-2">
                  {vrpRunId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchExplanation}
                      className="flex items-center gap-2 text-orange-500 hover:text-orange-600 border-orange-200 hover:border-orange-300"
                    >
                      Forklaring
                    </Button>
                  )}
                  <Button
                    ref={mapButtonRef}
                    variant="outline"
                    size="sm"
                    onClick={() => setIsMapModalOpen(true)}
                    className="flex items-center gap-2"
                  >
                    <MapPin className="h-4 w-4" />
                    Kortvisning
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
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
                                   Vælg anden inspektør
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
                                   Vælg anden inspektør
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
                    Ingen ruter endnu – kør 'Til VRP' for at generere ruter.
                  </AlertDescription>
                </Alert>
              )}
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
            <Button 
              variant="outline" 
              disabled={isSubmitting || isSyncing}
              onClick={handleCloseAttempt}
            >
              Annullér
            </Button>
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

      {/* Map Modal Overlay */}
      {groupedRoutes && (
        <MapModal
          open={isMapModalOpen}
          onClose={() => {
            setIsMapModalOpen(false);
            setTimeout(() => mapButtonRef.current?.focus(), 100);
          }}
          groupedRoutes={groupedRoutes}
          selectedInspectorId={selectedInspectorId}
          inspectionsMap={inspectionsMap}
          onInspectorSelect={setSelectedInspectorId}
          inspectorBases={inspectorBases}
          roundtripEnabled={roundtripEnabled}
          setRoundtripEnabled={setRoundtripEnabled}
          isFetchingBases={isFetchingBases}
        />
      )}

      {/* Exit Confirmation Dialog */}
      <AlertDialog open={showExitConfirmation} onOpenChange={setShowExitConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bekræft at forlade planlægning</AlertDialogTitle>
            <AlertDialogDescription>
              Du har genererede ruter. Vil du forlade denne visning? Ugemte ændringer kan gå tabt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelExit}>Bliv</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmExit} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Forlad
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Explanation Modal */}
      <ExplanationModal
        open={isExplanationOpen}
        onClose={() => setIsExplanationOpen(false)}
        explanationText={explanationText}
        isLoading={isLoadingExplanation}
      />
    </ErrorBoundary>
  );
}

// Explanation Modal Component
interface ExplanationModalProps {
  open: boolean;
  onClose: () => void;
  explanationText: string | null;
  isLoading: boolean;
}

function ExplanationModal({
  open,
  onClose,
  explanationText,
  isLoading,
}: ExplanationModalProps) {
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ pointerEvents: 'auto' }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-[600px] max-h-[80vh] bg-background border rounded-lg shadow-lg flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">AI Forklaring af rutevalg</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : explanationText ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{explanationText}</ReactMarkdown>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Ingen forklaring tilgængelig for denne kørsel.
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

// Map Modal Component
interface MapModalProps {
  open: boolean;
  onClose: () => void;
  groupedRoutes: any;
  selectedInspectorId: string | null;
  inspectionsMap: Map<string, any>;
  onInspectorSelect: (id: string | null) => void;
  inspectorBases: Map<string, InspectorBase>;
  roundtripEnabled: boolean;
  setRoundtripEnabled: (enabled: boolean) => void;
  isFetchingBases: boolean;
}

function MapModal({
  open,
  onClose,
  groupedRoutes,
  selectedInspectorId,
  inspectionsMap,
  onInspectorSelect,
  inspectorBases,
  roundtripEnabled,
  setRoundtripEnabled,
  isFetchingBases,
}: MapModalProps) {
  // Handle Esc key and body scroll
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    
    if (open) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-background flex flex-col"
      aria-modal="true"
      role="dialog"
      aria-label="Kortvisning"
      style={{ pointerEvents: 'auto' }}
    >
      {/* Header - use flexbox layout for better control */}
      <div className="relative z-50 bg-background border-b flex-shrink-0">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Button
              id="btn-luk-kort"
              variant="outline"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="flex items-center gap-2 z-50"
              style={{ pointerEvents: 'auto' }}
            >
              <X className="h-4 w-4" />
              Luk kort
            </Button>
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Tilbage til ruteoversigt
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <label className="text-sm flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={roundtripEnabled}
                onChange={(e) => setRoundtripEnabled(e.target.checked)}
                className="rounded border-input"
              />
              Inkludér retur til base
            </label>
            {isFetchingBases && (
              <span className="text-xs text-muted-foreground">Henter base-adresser…</span>
            )}
          </div>
        </div>
      </div>

      {/* Map content - flex-1 to fill remaining space */}
      <div className="relative flex-1 overflow-hidden">
        <RouteMapView
          key="modal-map"
          inspectorRoutes={groupedRoutes.inspector_routes}
          selectedInspectorId={selectedInspectorId}
          inspectionsMap={inspectionsMap}
          onInspectorSelect={onInspectorSelect}
          inspectorBases={inspectorBases}
          roundtrip={roundtripEnabled}
        />
      </div>
    </div>
  );
}
