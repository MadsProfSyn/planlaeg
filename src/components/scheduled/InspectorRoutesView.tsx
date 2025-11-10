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
  DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
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

// Sortable wrapper for inspection cards
function SortableInspectionCard({
  assignment,
  onReassign,
}: {
  assignment: ProposedAssignment;
  onReassign: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: assignment.id,
    data: assignment,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <InspectionCard assignment={assignment} isDragging={isDragging} onReassign={onReassign} />
    </div>
  );
}

// Drop indicator component
function DropIndicator({ position }: { position: number }) {
  return (
    <div className="relative h-1 my-1">
      <div className="absolute inset-0 bg-primary rounded-full opacity-50" />
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full whitespace-nowrap">
        Slip her
      </div>
    </div>
  );
}

function DraggableInspectionCard({
  assignment,
  onReassign,
}: {
  assignment: ProposedAssignment;
  onReassign: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
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
  dropIndicatorPosition,
}: {
  inspectorId: string;
  inspectorName: string;
  assignments: ProposedAssignment[];
  onReassignClick: (assignment: ProposedAssignment) => void;
  dropIndicatorPosition: number | null;
}) {
  const { setNodeRef, isOver } = useSortable({
    id: inspectorId,
    data: { type: 'lane', inspectorId },
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
        <SortableContext items={assignments.map(a => a.id)} strategy={verticalListSortingStrategy}>
          {assignments.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              Ingen syn tildelt
            </div>
          ) : (
            assignments.map((assignment, index) => (
              <React.Fragment key={assignment.id}>
                {dropIndicatorPosition === index && <DropIndicator position={index} />}
                <SortableInspectionCard
                  assignment={assignment}
                  onReassign={() => onReassignClick(assignment)}
                />
              </React.Fragment>
            ))
          )}
          {dropIndicatorPosition === assignments.length && <DropIndicator position={assignments.length} />}
        </SortableContext>
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
  const [dropIndicator, setDropIndicator] = React.useState<{
    inspectorId: string;
    position: number;
  } | null>(null);

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

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      setDropIndicator(null);
      return;
    }

    const activeAssignment = assignments.find(a => a.id === active.id);
    const overData = over.data.current;

    if (!activeAssignment) return;

    // Determine drop position
    if (overData?.type === 'lane') {
      // Dropped on empty space in lane
      const targetInspectorId = overData.inspectorId;
      const targetGroup = groupedAssignments.find(g => g.inspectorId === targetInspectorId);
      setDropIndicator({
        inspectorId: targetInspectorId,
        position: targetGroup?.assignments.length || 0,
      });
    } else {
      // Dropped on another assignment
      const overAssignment = assignments.find(a => a.id === over.id);
      if (overAssignment) {
        const targetGroup = groupedAssignments.find(g => g.inspectorId === overAssignment.inspector_id);
        const overIndex = targetGroup?.assignments.findIndex(a => a.id === over.id);
        if (overIndex !== undefined && overIndex >= 0) {
          setDropIndicator({
            inspectorId: overAssignment.inspector_id,
            position: overIndex,
          });
        }
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setDropIndicator(null);

    if (!over || active.id === over.id) return;

    const assignmentId = active.id as string;
    const assignment = assignments.find((a) => a.id === assignmentId);
    if (!assignment) return;

    // Determine target inspector
    let newInspectorId: string;
    const overData = over.data.current;
    
    if (overData?.type === 'lane') {
      newInspectorId = overData.inspectorId;
    } else {
      const overAssignment = assignments.find(a => a.id === over.id);
      if (!overAssignment) return;
      newInspectorId = overAssignment.inspector_id;
    }

    if (assignment.inspector_id === newInspectorId) return;

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

  // Create sortable items for all lanes
  const allInspectorIds = groupedAssignments.map(g => g.inspectorId);

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={allInspectorIds} strategy={verticalListSortingStrategy}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {groupedAssignments.map((group) => (
              <InspectorLane
                key={group.inspectorId}
                inspectorId={group.inspectorId}
                inspectorName={group.inspectorName}
                assignments={group.assignments}
                onReassignClick={handleReassignClick}
                dropIndicatorPosition={
                  dropIndicator?.inspectorId === group.inspectorId ? dropIndicator.position : null
                }
              />
            ))}
          </div>
        </SortableContext>

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
