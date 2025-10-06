import * as React from "react";
import { useState, useEffect } from "react";
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
import { Calendar, Clock, MapPin, User, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useVrpOptimization } from "@/hooks/useVrpOptimization";
import { approveVrpAssignments, getInspectionsByIds } from "@/lib/vrp";
import { useToast } from "@/hooks/use-toast";
import type { VrpAssignment } from "@/types/vrp";

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

  // Extract unique target dates from inspections
  const targetDates = React.useMemo(() => {
    const dates = inspections
      .map((i) => i.preferred_date)
      .filter((d) => d);
    return Array.from(new Set(dates));
  }, [inspections]);

  // Use VRP optimization hook
  const { routePlan, isLoading: isLoadingRoutes, error: routeError } = useVrpOptimization({
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
      const datetime = `${assignment.scheduled_date}T${assignment.start_time}`;
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
      const assignments: VrpAssignment[] = routePlan.assignments.map((assignment) => {
        const userDatetime = datetimeByInspection[assignment.inspection_id];
        const [date, time] = userDatetime.split("T");
        
        return {
          ...assignment,
          scheduled_date: date,
          start_time: time,
        };
      });

      const vrpRunId = crypto.randomUUID();

      const response = await approveVrpAssignments({
        vrp_run_id: vrpRunId,
        assignments,
        inspection_ids: selectedInspectionIds,
      });

      toast({
        title: "Syn planlagt",
        description: `${response.approved_count} syn blev planlagt`,
      });

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
    }
  };

  const hasMissingData = inspections.some(
    (inspection) => !datetimeByInspection[inspection.id]
  );

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            Planlæg syn ({selectedInspectionIds.length} valgt)
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            {/* Left Panel: Inspection Details */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Detaljer pr. syn
              </h3>

              <ScrollArea className="h-[500px] pr-4">
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

                          {assignment && (
                            <div className="flex items-center gap-2 text-sm">
                              <User className="h-4 w-4 text-primary" />
                              <span className="font-medium">Tildelt:</span>
                              <span>{assignment.inspector_name}</span>
                            </div>
                          )}

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
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : routeError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Kunne ikke hente rute. Prøv igen.
                    <br />
                    <span className="text-xs">{routeError}</span>
                  </AlertDescription>
                </Alert>
              ) : routePlan ? (
                <>
                  <div className="bg-primary/10 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4" />
                      <span className="font-medium">Estimeret tid:</span>
                      <span>{routePlan.total_eta_minutes} min</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4" />
                      <span className="font-medium">Distance:</span>
                      <span>{routePlan.total_distance_km.toFixed(1)} km</span>
                    </div>
                  </div>

                  <ScrollArea className="h-[420px] pr-4">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm text-muted-foreground">
                        Optimeret rute:
                      </h4>
                      {routePlan.assignments.map((assignment, index) => (
                        <div
                          key={assignment.inspection_id}
                          className="flex items-start gap-3 p-3 border rounded-lg bg-card"
                        >
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
                            {index + 1}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="font-medium text-sm">
                              {assignment.inspector_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {assignment.inspection_address || inspections.find(i => i.id === assignment.inspection_id)?.address}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {assignment.start_time} - {assignment.end_time}
                            </div>
                            {assignment.travel_from_previous_mins > 0 && (
                              <div className="text-xs text-muted-foreground">
                                ↳ {assignment.travel_from_previous_mins} min kørsel
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
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
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isSubmitting}>
              Annullér
            </Button>
          </DialogClose>
          <Button
            onClick={handleApprove}
            disabled={hasMissingData || isSubmitting || !routePlan}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Planlægger...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Godkend syn
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
