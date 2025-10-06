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
      <div className="text-center py-12">
        <div className="text-muted-foreground">
          <p className="text-lg font-medium">Ingen planlagte syn</p>
          <p className="text-sm mt-1">
            Planlagte syn vises her efter godkendelse
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tildelt</TableHead>
            <TableHead>Adresse</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Dato</TableHead>
            <TableHead>Tidspunkt</TableHead>
            <TableHead>Afdeling</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-center">Sekv.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((assignment) => (
            <TableRow key={assignment.id}>
              <TableCell className="font-medium">
                {assignment.inspector_name || "Ikke tildelt"}
              </TableCell>
              <TableCell>{assignment.inspection_address}</TableCell>
              <TableCell>
                <Badge variant={getTypeVariant(assignment.inspection_type || "")}>
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
