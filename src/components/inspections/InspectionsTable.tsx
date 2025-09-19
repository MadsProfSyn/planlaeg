import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Inspection } from "@/lib/supabase";
import { formatDateForDisplay } from "@/lib/date-utils";

interface InspectionsTableProps {
  inspections: Inspection[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  isLoading?: boolean;
  totalCount?: number;
}

const getTypeVariant = (type: string) => {
  switch (type) {
    case "Proforma":
      return "default";
    case "Projektsyn":
      return "secondary";
    case "Indflytningssyn":
      return "outline";
    case "Fraflytningssyn":
      return "destructive";
    default:
      return "default";
  }
};

export function InspectionsTable({
  inspections,
  selectedIds,
  onSelectionChange,
  isLoading = false,
  totalCount,
}: InspectionsTableProps) {
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = inspections.map((inspection) => inspection.id);
      const newSelection = Array.from(new Set([...selectedIds, ...allIds]));
      onSelectionChange(newSelection);
    } else {
      const currentPageIds = inspections.map((inspection) => inspection.id);
      const newSelection = selectedIds.filter(
        (id) => !currentPageIds.includes(id)
      );
      onSelectionChange(newSelection);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter((selectedId) => selectedId !== id));
    }
  };

  const currentPageIds = inspections.map((inspection) => inspection.id);
  const isAllCurrentPageSelected = 
    currentPageIds.length > 0 && 
    currentPageIds.every((id) => selectedIds.includes(id));
  const isSomeCurrentPageSelected = 
    currentPageIds.some((id) => selectedIds.includes(id));

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center space-x-4">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (inspections.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-muted-foreground">
          <p className="text-lg font-medium">No inspections found</p>
          <p className="text-sm mt-1">
            Try adjusting your filters to see more results.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {selectedIds.length > 0 && (
        <div className="bg-muted/50 px-4 py-2 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {selectedIds.length}
            </span>{" "}
            inspection{selectedIds.length === 1 ? "" : "s"} selected
            {totalCount && (
              <span> out of {totalCount} total</span>
            )}
          </p>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={isAllCurrentPageSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all inspections on this page"
                  className={
                    !isAllCurrentPageSelected && isSomeCurrentPageSelected
                      ? "data-[state=checked]:bg-primary data-[state=indeterminate]:bg-primary"
                      : ""
                  }
                />
              </TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Department</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inspections.map((inspection) => {
              const isSelected = selectedIds.includes(inspection.id);
              return (
                <TableRow
                  key={inspection.id}
                  className={isSelected ? "bg-muted/50" : ""}
                >
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) =>
                        handleSelectRow(inspection.id, checked as boolean)
                      }
                      aria-label={`Select inspection at ${inspection.address}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {inspection.address}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getTypeVariant(inspection.type)}>
                      {inspection.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatDateForDisplay(inspection.date_local)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {inspection.department}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}