import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { MondayItem } from "@/lib/supabase";

interface InspectionsPanelProps {
  inspections: MondayItem[];
  isLoading: boolean;
  selectedIds: number[];
  onSelect: (id: number) => void;
  hiddenIds?: Set<number>;
}

const TYPE_MAP: Record<string, string> = {
  Fraflytningssyn: "FF",
  Indflytningssyn: "IF",
  Projektsyn: "PS",
  Proforma: "PA",
};

const TYPE_COLORS: Record<string, string> = {
  FF: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  IF: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  PS: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  PA: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

function getTypeAbbreviation(type: string | null): string {
  if (!type) return "?";
  return TYPE_MAP[type] || type.substring(0, 2).toUpperCase();
}

function getTypeColor(abbr: string): string {
  return TYPE_COLORS[abbr] || "bg-muted text-muted-foreground";
}

interface DraggableInspectionProps {
  inspection: MondayItem;
  isSelected: boolean;
  onSelect: (id: number) => void;
}

function DraggableInspection({ inspection, isSelected, onSelect }: DraggableInspectionProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `inspection-${inspection.id}`,
    data: { inspection },
  });
  
  const abbr = getTypeAbbreviation(inspection.synstype);
  
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(inspection.id)}
      className={cn(
        "p-3 rounded-lg border cursor-grab transition-all touch-none",
        "hover:bg-muted/50",
        isSelected && "ring-2 ring-primary bg-primary/5",
        isDragging && "opacity-50 cursor-grabbing"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {inspection.adresse || "Ukendt adresse"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {inspection.antal_vaerelser ?? "?"} værelser
          </p>
        </div>
        <Badge className={cn("flex-shrink-0", getTypeColor(abbr))}>
          {abbr}
        </Badge>
      </div>
    </div>
  );
}

export function InspectionsPanel({
  inspections,
  isLoading,
  selectedIds,
  onSelect,
  hiddenIds,
}: InspectionsPanelProps) {
  // Filter out hidden inspections (assigned ones)
  const visibleInspections = hiddenIds
    ? inspections.filter((i) => !hiddenIds.has(i.id))
    : inspections;

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="text-lg">Synsopgaver</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-6 pb-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : visibleInspections.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              Ingen synsopgaver for denne dato
            </div>
          ) : (
            <div className="space-y-2">
              {visibleInspections.map((inspection) => (
                <DraggableInspection
                  key={inspection.id}
                  inspection={inspection}
                  isSelected={selectedIds.includes(inspection.id)}
                  onSelect={onSelect}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
