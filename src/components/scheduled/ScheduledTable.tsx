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
import { CalendarCheck } from "lucide-react";
import { formatDateForDisplay } from "@/lib/date-utils";
import type { ProposedAssignment } from "@/lib/scheduled";

interface ScheduledTableProps {
  assignments: ProposedAssignment[];
  isLoading?: boolean;
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
}: ScheduledTableProps) {
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
            <TableHead className="h-12 font-semibold">Tildelt</TableHead>
            <TableHead className="h-12 font-semibold">Adresse</TableHead>
            <TableHead className="h-12 font-semibold">Type</TableHead>
            <TableHead className="h-12 font-semibold">Dato</TableHead>
            <TableHead className="h-12 font-semibold">Tidspunkt</TableHead>
            <TableHead className="h-12 font-semibold">Afdeling</TableHead>
            <TableHead className="h-12 font-semibold">Status</TableHead>
            <TableHead className="text-center h-12 font-semibold">Sekv.</TableHead>
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
