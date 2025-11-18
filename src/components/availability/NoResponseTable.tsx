import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Users, Calendar, CheckCircle } from "lucide-react";
import { formatDateForDisplay } from "@/lib/date-utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface NoResponseInspector {
  inspector_id: string;
  inspector_name: string;
  email: string;
  phone: string;
  department: string;
  date_local: string;
  availability_status: 'NO_RESPONSE';
}

interface NoResponseTableProps {
  data: NoResponseInspector[];
  selectedInspectors: Set<string>;
  onSelectionChange: (inspectorIds: Set<string>) => void;
  isLoading?: boolean;
}

export function NoResponseTable({
  data,
  selectedInspectors,
  onSelectionChange,
  isLoading = false,
}: NoResponseTableProps) {
  const groupedByDate = React.useMemo(() => {
    const groups: Record<string, NoResponseInspector[]> = {};
    
    data.forEach(inspector => {
      if (!groups[inspector.date_local]) {
        groups[inspector.date_local] = [];
      }
      groups[inspector.date_local].push(inspector);
    });
    
    return groups;
  }, [data]);

  const handleToggleSelection = (inspectorId: string) => {
    const newSelection = new Set(selectedInspectors);
    
    if (newSelection.has(inspectorId)) {
      newSelection.delete(inspectorId);
    } else {
      newSelection.add(inspectorId);
    }
    
    onSelectionChange(newSelection);
  };

  const handleSelectAll = (date: string) => {
    const inspectorsForDate = groupedByDate[date] || [];
    const newSelection = new Set(selectedInspectors);
    
    const allSelected = inspectorsForDate.every(i => 
      newSelection.has(i.inspector_id)
    );
    
    if (allSelected) {
      inspectorsForDate.forEach(i => newSelection.delete(i.inspector_id));
    } else {
      inspectorsForDate.forEach(i => newSelection.add(i.inspector_id));
    }
    
    onSelectionChange(newSelection);
  };

  const handleRowClick = (inspectorId: string) => {
    handleToggleSelection(inspectorId);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Ikke angivet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle}
        title="Alle har svaret"
        description="Alle synskonsulenter har angivet deres status for den valgte periode"
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Ikke angivet
          <Badge variant="destructive">{data.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {Object.keys(groupedByDate).sort().map(date => (
          <div key={date} className="mb-6 last:mb-0">
            <div className="flex items-center gap-3 mb-3 bg-muted p-3 rounded-lg">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">{formatDateForDisplay(date)}</h3>
              <Badge variant="secondary">
                {groupedByDate[date].length} synskonsulenter
              </Badge>
              <Checkbox
                checked={groupedByDate[date].every(i => 
                  selectedInspectors.has(i.inspector_id)
                )}
                onCheckedChange={() => handleSelectAll(date)}
                className="ml-auto"
              />
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Vælg</TableHead>
                  <TableHead>Navn</TableHead>
                  <TableHead>Afdeling</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefon</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedByDate[date].map(inspector => (
                  <TableRow
                    key={inspector.inspector_id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(inspector.inspector_id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedInspectors.has(inspector.inspector_id)}
                        onCheckedChange={() => handleToggleSelection(inspector.inspector_id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{inspector.inspector_name}</TableCell>
                    <TableCell>{inspector.department}</TableCell>
                    <TableCell className="text-muted-foreground">{inspector.email}</TableCell>
                    <TableCell className="text-muted-foreground">{inspector.phone}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
