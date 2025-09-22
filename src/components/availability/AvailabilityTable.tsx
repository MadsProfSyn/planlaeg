import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ChevronUp, ChevronDown } from "lucide-react";
import { formatDateForDisplay } from "@/lib/date-utils";

export interface AvailableInspector {
  availability_id: string;
  inspector_uuid: string;
  navn: string;
  afdeling: string;
  synstyper: string[];
  adresse: string;
  dato: string;
  start_tid: string | null;
  slut_tid: string | null;
  tidspunkt_label: string;
}

interface AvailabilityTableProps {
  data: AvailableInspector[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSortChange: (column: string, direction: 'asc' | 'desc') => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  isLoading?: boolean;
}

export function AvailabilityTable({
  data,
  total,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onSortChange,
  sortBy,
  sortOrder,
  isLoading = false,
}: AvailabilityTableProps) {
  const handleSort = (column: string) => {
    const newDirection = sortBy === column && sortOrder === 'asc' ? 'desc' : 'asc';
    onSortChange(column, newDirection);
  };

  const getSortIcon = (column: string) => {
    if (sortBy !== column) {
      return <ChevronUp className="ml-1 h-4 w-4 text-muted-foreground" />;
    }
    return sortOrder === 'asc' ? 
      <ChevronUp className="ml-1 h-4 w-4 text-primary" /> : 
      <ChevronDown className="ml-1 h-4 w-4 text-primary" />;
  };

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center gap-4 mb-4">
          <h3 className="text-lg font-semibold">
            Tilgængelige synskonsulenter
          </h3>
          <Badge variant="secondary">
            {total} resultater
          </Badge>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader className="sticky top-0 bg-background border-b">
              <TableRow>
                <TableHead className="p-2 font-medium text-foreground">
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('navn')}
                    className="h-auto p-0 font-medium text-foreground hover:text-foreground hover:bg-muted"
                  >
                    Navn
                    {getSortIcon('navn')}
                  </Button>
                </TableHead>
                <TableHead className="p-2 font-medium text-foreground">
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('afdeling')}
                    className="h-auto p-0 font-medium text-foreground hover:text-foreground hover:bg-muted"
                  >
                    Afdeling
                    {getSortIcon('afdeling')}
                  </Button>
                </TableHead>
                <TableHead className="p-2 font-medium text-foreground">Synstyper</TableHead>
                <TableHead className="p-2 font-medium text-foreground">
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('adresse')}
                    className="h-auto p-0 font-medium text-foreground hover:text-foreground hover:bg-muted"
                  >
                    Adresse
                    {getSortIcon('adresse')}
                  </Button>
                </TableHead>
                <TableHead className="p-2 font-medium text-foreground">
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('dato')}
                    className="h-auto p-0 font-medium text-foreground hover:text-foreground hover:bg-muted"
                  >
                    Dato
                    {getSortIcon('dato')}
                  </Button>
                </TableHead>
                <TableHead className="p-2 font-medium text-foreground">Tidspunkt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Indlæser...
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Ingen resultater. Justér filtre eller søgning.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((inspector, index) => (
                  <TableRow 
                    key={inspector.availability_id} 
                    className={index % 2 === 0 ? "bg-muted/50" : "bg-background"}
                  >
                    <TableCell className="p-3 font-medium">
                      {inspector.navn}
                    </TableCell>
                    <TableCell className="p-3">{inspector.afdeling}</TableCell>
                    <TableCell className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {inspector.synstyper.map((type) => (
                          <Badge key={type} variant="secondary" className="text-xs">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="p-3">{inspector.adresse}</TableCell>
                    <TableCell className="p-3">
                      {formatDateForDisplay(inspector.dato)}
                    </TableCell>
                    <TableCell className="p-3">{inspector.tidspunkt_label}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Viser {((page - 1) * pageSize) + 1} til {Math.min(page * pageSize, total)} af {total} resultater
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
              >
                Forrige
              </Button>
              <span className="text-sm">
                Side {page} af {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
              >
                Næste
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}