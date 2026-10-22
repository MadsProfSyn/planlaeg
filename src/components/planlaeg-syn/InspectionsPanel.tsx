import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Info, Search, X } from "lucide-react";
import type { MondayItem } from "@/lib/supabase";

interface InspectionsPanelProps {
  inspections: MondayItem[];
  isLoading: boolean;
  selectedIds: number[];
  onSelect: (id: number) => void;
  onSelectMany: (ids: number[]) => void;
  hiddenIds?: Set<number>;
  isDragActive?: boolean;
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
          {inspection.yderligere_info?.trim() && (
            <div className="flex items-start gap-1 mt-1 text-muted-foreground" title={inspection.yderligere_info}>
              <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span className="text-xs line-clamp-2">{inspection.yderligere_info}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge className={cn("flex-shrink-0", getTypeColor(abbr))}>
            {abbr}
          </Badge>
          {inspection.dato_tid && (
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              {(() => {
                try {
                  return format(parseISO(inspection.dato_tid), "dd/MM/yyyy");
                } catch {
                  return inspection.dato_tid;
                }
              })()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function CancelDropZone() {
  const { isOver, setNodeRef } = useDroppable({ id: "cancel-drop" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 mb-3 transition-colors",
        isOver
          ? "border-destructive bg-destructive/10 text-destructive"
          : "border-muted-foreground/30 text-muted-foreground"
      )}
    >
      <X className="h-4 w-4" />
      <span className="text-sm font-medium">Slip her for at annullere</span>
    </div>
  );
}

export function InspectionsPanel({
  inspections,
  isLoading,
  selectedIds,
  onSelect,
  onSelectMany,
  hiddenIds,
  isDragActive,
}: InspectionsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [countInput, setCountInput] = useState("");

  const visibleInspections = hiddenIds
    ? inspections.filter((i) => !hiddenIds.has(i.id))
    : inspections;

  const filteredInspections = useMemo(() => {
    if (!searchQuery.trim()) return visibleInspections;
    const q = searchQuery.toLowerCase();
    return visibleInspections.filter((i) =>
      (i.adresse ?? "").toLowerCase().includes(q)
    );
  }, [visibleInspections, searchQuery]);

  const count = parseInt(countInput, 10);
  const canSelectCount = !isNaN(count) && count > 0 && filteredInspections.length > 0;

  const handleSelectCount = () => {
    if (!canSelectCount) return;
    onSelectMany(filteredInspections.slice(0, count).map((i) => i.id));
  };

  return (
    <Card className="flex flex-col h-full min-h-0 overflow-hidden">
      <CardHeader className="pb-3 flex-shrink-0 space-y-2">
        <CardTitle className="text-lg">Synsopgaver</CardTitle>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Søg adresse..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            type="number"
            placeholder="Antal"
            min={1}
            max={filteredInspections.length}
            value={countInput}
            onChange={(e) => setCountInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSelectCount();
              }
            }}
            className="w-20 h-9"
          />
          <Button size="sm" variant="outline" onClick={handleSelectCount} disabled={!canSelectCount}>
            Vælg
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onSelectMany(filteredInspections.map((i) => i.id))}
            disabled={filteredInspections.length === 0}
          >
            Vælg alle
          </Button>
          {selectedIds.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground">{selectedIds.length} valgt</span>
              <Button size="sm" variant="ghost" onClick={() => onSelectMany([])}>
                Ryd valg
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-hidden p-0">
        <ScrollArea className="h-full min-h-0 px-6 pb-6">
          {isDragActive && <CancelDropZone />}
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : filteredInspections.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              {searchQuery.trim()
                ? "Ingen synsopgaver matcher søgningen"
                : "Ingen synsopgaver for denne dato"}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredInspections.map((inspection) => (
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
