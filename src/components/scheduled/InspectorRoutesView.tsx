import * as React from "react";
import { ProposedAssignment, reassignInspector } from "@/lib/scheduled";
import { InspectionCard } from "./InspectionCard";
import { InspectorSelector } from "./InspectorSelector";
import { RouteTabSlider } from "./RouteTabSlider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

interface InspectorRoutesViewProps {
  assignments: ProposedAssignment[];
}

export function InspectorRoutesView({ assignments }: InspectorRoutesViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectorOpen, setSelectorOpen] = React.useState(false);
  const [selectedAssignment, setSelectedAssignment] = React.useState<ProposedAssignment | null>(null);
  const [selectedRouteIndex, setSelectedRouteIndex] = React.useState(0);

  // Group assignments by inspector
  const groupedAssignments = React.useMemo(() => {
    const groups = new Map<string, ProposedAssignment[]>();
    
    assignments.forEach((assignment) => {
      const key = assignment.inspector_id;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(assignment);
    });

    // Sort assignments within each group by sequence
    groups.forEach((assignmentList) => {
      assignmentList.sort((a, b) => a.sequence_in_route - b.sequence_in_route);
    });

    return Array.from(groups.entries()).map(([inspectorId, assignments]) => {
      const totalTime = assignments.reduce((sum, a) => {
        const start = new Date(`2000-01-01T${a.start_time}`);
        const end = new Date(`2000-01-01T${a.end_time}`);
        return sum + (end.getTime() - start.getTime()) / 60000;
      }, 0);

      const totalTravel = assignments.reduce((sum, a) => sum + (a.travel_from_previous_mins || 0), 0);

      // Calculate total distance (simple sum from assignments if available)
      const totalDistance = assignments.reduce((sum, a) => {
        // If we have distance data in the assignment, use it
        return sum;
      }, 0);

      return {
        inspector_id: inspectorId,
        inspector_name: assignments[0].inspector_name || "Unknown",
        assignments,
        total_time_mins: totalTime + totalTravel,
        total_distance_km: totalDistance,
        total_inspections: assignments.length,
      };
    });
  }, [assignments]);

  const handleReassignClick = (assignment: ProposedAssignment) => {
    setSelectedAssignment(assignment);
    setSelectorOpen(true);
  };

  const handleInspectorSelect = async (inspectorId: string, inspectorName: string) => {
    if (!selectedAssignment) return;

    try {
      await reassignInspector(selectedAssignment.id, inspectorId);
      
      toast({
        title: "Inspektør skiftet",
        description: `Syn tildelt til ${inspectorName}`,
      });

      queryClient.invalidateQueries({ queryKey: ["proposed-assignments"] });
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke skifte inspektør",
        variant: "destructive",
      });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const selectedRoute = groupedAssignments[selectedRouteIndex];

  return (
    <div id="ruter-container" className="w-full">
      {/* Route Tabs */}
      {groupedAssignments.length > 1 && (
        <RouteTabSlider
          routes={groupedAssignments}
          selectedRouteIndex={selectedRouteIndex}
          onSelectRoute={setSelectedRouteIndex}
        />
      )}

      {/* Selected Route Display */}
      {selectedRoute && (
        <div className="p-6">
          <div className="max-w-4xl mx-auto">
            {/* Route Header */}
            <div className="mb-6 p-4 border-2 rounded-xl bg-muted/30">
              <div className="flex items-center gap-4 mb-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/10 text-primary text-lg">
                    {getInitials(selectedRoute.inspector_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{selectedRoute.inspector_name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedRoute.assignments.length} syn tildelt
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {Math.round(selectedRoute.total_time_mins)} min
                </Badge>
                {selectedRoute.total_distance_km > 0 && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {selectedRoute.total_distance_km.toFixed(1)} km kørsel
                  </Badge>
                )}
              </div>
            </div>

            {/* Inspections List */}
            <div className="space-y-3">
              {selectedRoute.assignments.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-sm text-muted-foreground border-2 border-dashed rounded-xl">
                  Ingen syn tildelt
                </div>
              ) : (
                selectedRoute.assignments.map((assignment) => (
                  <InspectionCard
                    key={assignment.id}
                    assignment={assignment}
                    isDragging={false}
                    onReassign={() => handleReassignClick(assignment)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {selectedAssignment && (
        <InspectorSelector
          open={selectorOpen}
          onOpenChange={setSelectorOpen}
          date={selectedAssignment.scheduled_date}
          inspectionType={selectedAssignment.inspection_type || ""}
          onSelect={handleInspectorSelect}
        />
      )}
    </div>
  );
}
