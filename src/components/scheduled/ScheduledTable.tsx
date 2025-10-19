import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarCheck, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { formatDateForDisplay } from "@/lib/date-utils";
import type { ProposedAssignment } from "@/lib/scheduled";

export type SortColumn =
  | "inspector_name"
  | "inspection_address"
  | "inspection_type"
  | "scheduled_date"
  | "start_time"
  | "inspection_department"
  | "status"
  | "sequence_in_route";

export type SortDirection = "asc" | "desc";

interface ScheduledTableProps {
  assignments: ProposedAssignment[];
  isLoading?: boolean;
  sortColumn?: SortColumn | null;
  sortDirection?: SortDirection;
  onSort?: (column: SortColumn) => void;
}

const getStatusVariant = (status: string) => {
  switch (status) {
    case "PROPOSED":
      return "secondary";
    case "APPROVED":
      return "default";
    case "SCHEDULED":
      return "outline";
    default:
      return "secondary";
  }
};

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

export function ScheduledTable({
  assignments,
  isLoading = false,
  sortColumn = null,
  sortDirection = "asc",
  onSort,
}: ScheduledTableProps) {
  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    );
  };

  const handleHeaderClick = (column: SortColumn) => {
    if (onSort) {
      onSort(column);
    }
  };
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center space-x-4">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <CalendarCheck className="h-12 w-12 text-primary/60" />
        </div>
        <h3 className="text-2xl font-bold mb-3">Ingen planlagte syn</h3>
        <p className="text-muted-foreground max-w-md text-lg">
          Planlagte syn vises her efter godkendelse
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader className="bg-muted/50 sticky top-0 z-10">
          <TableRow className="hover:bg-transparent">
            <TableHead
              className="h-12 font-semibold cursor-pointer hover:bg-muted/70 transition-colors select-none"
              onClick={() => handleHeaderClick("inspector_name")}
            >
              <div className="flex items-center gap-2">
                Tildelt
                {getSortIcon("inspector_name")}
              </div>
            </TableHead>
            <TableHead
              className="h-12 font-semibold cursor-pointer hover:bg-muted/70 transition-colors select-none"
              onClick={() => handleHeaderClick("inspection_address")}
            >
              <div className="flex items-center gap-2">
                Adresse
                {getSortIcon("inspection_address")}
              </div>
            </TableHead>
            <TableHead
              className="h-12 font-semibold cursor-pointer hover:bg-muted/70 transition-colors select-none"
              onClick={() => handleHeaderClick("inspection_type")}
            >
              <div className="flex items-center gap-2">
                Type
                {getSortIcon("inspection_type")}
              </div>
            </TableHead>
            <TableHead
              className="h-12 font-semibold cursor-pointer hover:bg-muted/70 transition-colors select-none"
              onClick={() => handleHeaderClick("scheduled_date")}
            >
              <div className="flex items-center gap-2">
                Dato
                {getSortIcon("scheduled_date")}
              </div>
            </TableHead>
            <TableHead
              className="h-12 font-semibold cursor-pointer hover:bg-muted/70 transition-colors select-none"
              onClick={() => handleHeaderClick("start_time")}
            >
              <div className="flex items-center gap-2">
                Tidspunkt
                {getSortIcon("start_time")}
              </div>
            </TableHead>
            <TableHead
              className="h-12 font-semibold cursor-pointer hover:bg-muted/70 transition-colors select-none"
              onClick={() => handleHeaderClick("inspection_department")}
            >
              <div className="flex items-center gap-2">
                Afdeling
                {getSortIcon("inspection_department")}
              </div>
            </TableHead>
            <TableHead
              className="h-12 font-semibold cursor-pointer hover:bg-muted/70 transition-colors select-none"
              onClick={() => handleHeaderClick("status")}
            >
              <div className="flex items-center gap-2">
                Status
                {getSortIcon("status")}
              </div>
            </TableHead>
            <TableHead
              className="text-center h-12 font-semibold cursor-pointer hover:bg-muted/70 transition-colors select-none"
              onClick={() => handleHeaderClick("sequence_in_route")}
            >
              <div className="flex items-center justify-center gap-2">
                Sekv.
                {getSortIcon("sequence_in_route")}
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((assignment, index) => (
            <TableRow 
              key={assignment.id}
              className={`h-14 hover:bg-muted/30 transition-colors ${index % 2 === 0 ? 'bg-muted/10' : ''}`}
            >
              <TableCell className="font-medium">
                {assignment.inspector_name || "Ikke tildelt"}
              </TableCell>
              <TableCell>{assignment.inspection_address}</TableCell>
              <TableCell>
                <Badge 
                  variant={getTypeVariant(assignment.inspection_type || "")}
                  className="border"
                >
                  {assignment.inspection_type}
                </Badge>
              </TableCell>
              <TableCell>
                {formatDateForDisplay(assignment.scheduled_date)}
              </TableCell>
              <TableCell>
                {assignment.start_time} - {assignment.end_time}
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {assignment.inspection_department}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={getStatusVariant(assignment.status)}>
                  {assignment.status}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="secondary" className="rounded-full w-8 h-8 flex items-center justify-center">
                  {assignment.sequence_in_route}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
