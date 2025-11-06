import * as React from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ProposedAssignment, reassignInspector } from "@/lib/scheduled";
import { InspectionCard } from "./InspectionCard";
import { InspectorSelector } from "./InspectorSelector";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

interface InspectorRoutesViewProps {
  assignments: ProposedAssignment[];
}

function DraggableInspectionCard({
  assignment,
  onReassign,
}: {
  assignment: ProposedAssignment;
  onReassign: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: assignment.id,
    data: assignment,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <InspectionCard assignment={assignment} isDragging={isDragging} onReassign={onReassign} />
    </div>
  );
}

function InspectorLane({
  inspectorId,
  inspectorName,
  assignments,
  onReassignClick,
}: {
  inspectorId: string;
  inspectorName: string;
  assignments: ProposedAssignment[];
  onReassignClick: (assignment: ProposedAssignment) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: inspectorId,
  });

  const totalTime = assignments.reduce((sum, a) => {
    const start = new Date(`2000-01-01T${a.start_time}`);
    const end = new Date(`2000-01-01T${a.end_time}`);
    return sum + (end.getTime() - start.getTime()) / 60000;
  }, 0);

  const totalTravel = assignments.reduce((sum, a) => sum + (a.travel_from_previous_mins || 0), 0);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div
      ref={setNodeRef}
      className={`
        flex-1 min-w-[320px] max-w-[400px] rounded-xl border-2 bg-card transition-all
        ${isOver ? "border-primary bg-primary/5 shadow-lg" : "border-border"}
      `}
    >
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-primary">
              {getInitials(inspectorName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="font-semibold">{inspectorName}</h3>
            <p className="text-sm text-muted-foreground">{assignments.length} syn tildelt</p>
          </div>
        </div>

        <div className="flex gap-2 text-xs">
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {Math.round(totalTime + totalTravel)} min
          </Badge>
          {totalTravel > 0 && (
            <Badge variant="outline" className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {Math.round(totalTravel)} min kørsel
            </Badge>
          )}
        </div>
      </div>

      <div className="p-3 space-y-2 min-h-[200px]">
        {assignments.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            Ingen syn tildelt
          </div>
        ) : (
          assignments.map((assignment) => (
            <DraggableInspectionCard
              key={assignment.id}
              assignment={assignment}
              onReassign={() => onReassignClick(assignment)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function InspectorRoutesView({ assignments }: InspectorRoutesViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [selectorOpen, setSelectorOpen] = React.useState(false);
  const [selectedAssignment, setSelectedAssignment] = React.useState<ProposedAssignment | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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

    return Array.from(groups.entries()).map(([inspectorId, assignments]) => ({
      inspectorId,
      inspectorName: assignments[0].inspector_name || "Unknown",
      assignments,
    }));
  }, [assignments]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const assignmentId = active.id as string;
    const newInspectorId = over.id as string;

    // Find the assignment being moved
    const assignment = assignments.find((a) => a.id === assignmentId);
    if (!assignment || assignment.inspector_id === newInspectorId) return;

    // Find the new inspector name
    const newInspectorGroup = groupedAssignments.find((g) => g.inspectorId === newInspectorId);
    if (!newInspectorGroup) return;

    try {
      await reassignInspector(assignmentId, newInspectorId);
      
      toast({
        title: "Inspektør skiftet",
        description: `Syn flyttet til ${newInspectorGroup.inspectorName}`,
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

  const activeAssignment = activeId ? assignments.find((a) => a.id === activeId) : null;

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {groupedAssignments.map((group) => (
            <InspectorLane
              key={group.inspectorId}
              inspectorId={group.inspectorId}
              inspectorName={group.inspectorName}
              assignments={group.assignments}
              onReassignClick={handleReassignClick}
            />
          ))}
        </div>

        <DragOverlay>
          {activeAssignment ? (
            <div className="opacity-90">
              <InspectionCard
                assignment={activeAssignment}
                isDragging
                onReassign={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {selectedAssignment && (
        <InspectorSelector
          open={selectorOpen}
          onOpenChange={setSelectorOpen}
          date={selectedAssignment.scheduled_date}
          inspectionType={selectedAssignment.inspection_type || ""}
          onSelect={handleInspectorSelect}
        />
      )}
    </>
  );
}
