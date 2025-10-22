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
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ChevronUp, ChevronDown, Calendar } from "lucide-react";
import { formatDateForDisplay } from "@/lib/date-utils";
import { BookedShiftsDialog } from "./BookedShiftsDialog";

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
  scheduled_shifts: number;
  shift_details: Array<{
    type: string;
    start_time: string;
    end_time: string;
    duration_minutes: number;
    address?: string;
  }>;
  booked_minutes?: number;
  capacity_status?: string | null;
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
  const uniqueInspectorCount = React.useMemo(() => {
    const uniqueUuids = new Set(data.map(inspector => inspector.inspector_uuid));
    return uniqueUuids.size;
  }, [data]);

  const [selectedInspector, setSelectedInspector] = React.useState<{
    name: string;
    date: string;
    shifts: any[];
  } | null>(null);

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

  const handleBookedShiftsClick = (inspector: AvailableInspector) => {
    setSelectedInspector({
      name: inspector.navn,
      date: inspector.dato,
      shifts: inspector.shift_details || [],
    });
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="border-b">
          <div className="flex items-center gap-4">
            <h3 className="section-title">
              Tilgængelige synskonsulenter
            </h3>
            <Badge variant="secondary" className="text-base px-3 py-1">
              {total} resultater
            </Badge>
            <Badge className="text-base px-3 py-1 bg-black text-white hover:bg-black/90 border-transparent">
              {uniqueInspectorCount} SK'er
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/50 z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-12 font-semibold">
                    <Button 
                      variant="ghost" 
                      onClick={() => handleSort('navn')}
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                    >
                      Navn
                      {getSortIcon('navn')}
                    </Button>
                  </TableHead>
                  <TableHead className="h-12 font-semibold">
                    <Button 
                      variant="ghost" 
                      onClick={() => handleSort('afdeling')}
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                    >
                      Afdeling
                      {getSortIcon('afdeling')}
                    </Button>
                  </TableHead>
                  <TableHead className="h-12 font-semibold">Synstyper</TableHead>
                  <TableHead className="h-12 font-semibold">
                    <Button 
                      variant="ghost" 
                      onClick={() => handleSort('adresse')}
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                    >
                      Adresse
                      {getSortIcon('adresse')}
                    </Button>
                  </TableHead>
                  <TableHead className="h-12 font-semibold">
                    <Button 
                      variant="ghost" 
                      onClick={() => handleSort('dato')}
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                    >
                      Dato
                      {getSortIcon('dato')}
                    </Button>
                  </TableHead>
                  <TableHead className="h-12 font-semibold">Tidspunkt</TableHead>
                  <TableHead className="h-12 font-semibold">Bookede syn</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Indlæser...
                    </TableCell>
                  </TableRow>
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center">
                        <p className="text-base font-medium mb-1">Ingen resultater</p>
                        <p className="text-sm">Justér filtre eller søgning</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((inspector, index) => (
                    <TableRow 
                      key={inspector.availability_id} 
                      className={`h-14 hover:bg-muted/30 transition-colors ${index % 2 === 0 ? "bg-muted/10" : ""}`}
                    >
                      <TableCell className="font-medium">
                        {inspector.navn}
                      </TableCell>
                      <TableCell>{inspector.afdeling}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {inspector.synstyper.map((type) => (
                            <Badge key={type} variant="secondary" className="text-xs">
                              {type}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{inspector.adresse}</TableCell>
                      <TableCell>
                        {formatDateForDisplay(inspector.dato)}
                      </TableCell>
                      <TableCell>{inspector.tidspunkt_label}</TableCell>
                      <TableCell>
                        {inspector.scheduled_shifts > 0 ? (
                          <button
                            onClick={() => handleBookedShiftsClick(inspector)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer text-sm font-semibold"
                          >
                            <Calendar className="h-3.5 w-3.5" />
                            {inspector.scheduled_shifts}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-6 border-t">
              <div className="text-sm text-muted-foreground">
                Viser {((page - 1) * pageSize) + 1} til {Math.min(page * pageSize, total)} af {total} resultater
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(page - 1)}
                  disabled={page <= 1}
                  className="border-2"
                >
                  Forrige
                </Button>
                <span className="text-sm font-medium px-3">
                  Side {page} af {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(page + 1)}
                  disabled={page >= totalPages}
                  className="border-2"
                >
                  Næste
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Booked shifts dialog */}
      <BookedShiftsDialog
        open={selectedInspector !== null}
        onOpenChange={(open) => !open && setSelectedInspector(null)}
        inspectorName={selectedInspector?.name || ""}
        date={selectedInspector?.date || ""}
        shifts={selectedInspector?.shifts || []}
      />
    </div>
  );
}