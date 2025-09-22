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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ArrowUpDown, Download, Search } from "lucide-react";
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

interface ColumnFilter {
  navn?: string;
  afdeling?: string;
  synstyper?: string;
  adresse?: string;
  dato?: string;
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
  const [columnFilters, setColumnFilters] = React.useState<ColumnFilter>({});
  const [filteredData, setFilteredData] = React.useState(data);

  React.useEffect(() => {
    let filtered = [...data];

    // Apply column filters
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (value && value.trim() !== '') {
        filtered = filtered.filter(item => {
          const fieldValue = item[key as keyof AvailableInspector];
          if (Array.isArray(fieldValue)) {
            return fieldValue.some(v => v.toLowerCase().includes(value.toLowerCase()));
          }
          return String(fieldValue).toLowerCase().includes(value.toLowerCase());
        });
      }
    });

    setFilteredData(filtered);
  }, [data, columnFilters]);

  const handleSort = (column: string) => {
    const newDirection = sortBy === column && sortOrder === 'asc' ? 'desc' : 'asc';
    onSortChange(column, newDirection);
  };

  const updateColumnFilter = (column: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: value
    }));
  };

  const exportToCSV = () => {
    const headers = ['Navn', 'Afdeling', 'Synstyper', 'Adresse', 'Dato', 'Tidspunkt'];
    const csvData = [
      headers,
      ...filteredData.map(item => [
        item.navn,
        item.afdeling,
        item.synstyper.join(', '),
        item.adresse,
        formatDateForDisplay(item.dato),
        item.tidspunkt_label
      ])
    ];

    const csvContent = csvData.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tilgaengelige_synskonsulenter_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getSortIcon = (column: string) => (
    <ArrowUpDown 
      className={`ml-1 h-4 w-4 ${
        sortBy === column ? 'text-primary' : 'text-muted-foreground'
      }`} 
    />
  );

  const availableDepartments = [...new Set(data.map(item => item.afdeling))];
  const availableInspectionTypes = [...new Set(data.flatMap(item => item.synstyper))];

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold">
              Tilgængelige synskonsulenter
            </h3>
            <Badge variant="secondary">
              {total} resultater
            </Badge>
          </div>
          <Button onClick={exportToCSV} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Eksporter CSV
          </Button>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader className="sticky top-0 bg-[#2F61BF] text-white">
              <TableRow>
                <TableHead className="text-white p-2 font-medium">
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('navn')}
                    className="h-auto p-0 font-medium text-white hover:text-white hover:bg-white/10"
                  >
                    Navn
                    {getSortIcon('navn')}
                  </Button>
                </TableHead>
                <TableHead className="text-white p-2 font-medium">
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('afdeling')}
                    className="h-auto p-0 font-medium text-white hover:text-white hover:bg-white/10"
                  >
                    Afdeling
                    {getSortIcon('afdeling')}
                  </Button>
                </TableHead>
                <TableHead className="text-white p-2 font-medium">Synstyper</TableHead>
                <TableHead className="text-white p-2 font-medium">
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('adresse')}
                    className="h-auto p-0 font-medium text-white hover:text-white hover:bg-white/10"
                  >
                    Adresse
                    {getSortIcon('adresse')}
                  </Button>
                </TableHead>
                <TableHead className="text-white p-2 font-medium">
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('dato')}
                    className="h-auto p-0 font-medium text-white hover:text-white hover:bg-white/10"
                  >
                    Dato
                    {getSortIcon('dato')}
                  </Button>
                </TableHead>
                <TableHead className="text-white p-2 font-medium">Tidspunkt</TableHead>
              </TableRow>
              <TableRow>
                <TableHead className="p-2">
                  <Input
                    value={columnFilters.navn || ''}
                    onChange={(e) => updateColumnFilter('navn', e.target.value)}
                    placeholder="Filtrer navn..."
                    className="h-8"
                  />
                </TableHead>
                <TableHead className="p-2">
                  <Select
                    value={columnFilters.afdeling || ""}
                    onValueChange={(value) => updateColumnFilter('afdeling', value === "ALL" ? "" : value)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Alle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Alle afdelinger</SelectItem>
                      {availableDepartments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableHead>
                <TableHead className="p-2">
                  <Select
                    value={columnFilters.synstyper || ""}
                    onValueChange={(value) => updateColumnFilter('synstyper', value === "ALL" ? "" : value)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Alle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Alle typer</SelectItem>
                      {availableInspectionTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableHead>
                <TableHead className="p-2">
                  <Input
                    value={columnFilters.adresse || ''}
                    onChange={(e) => updateColumnFilter('adresse', e.target.value)}
                    placeholder="Filtrer adresse..."
                    className="h-8"
                  />
                </TableHead>
                <TableHead className="p-2">
                  <Input
                    type="date"
                    value={columnFilters.dato || ''}
                    onChange={(e) => updateColumnFilter('dato', e.target.value)}
                    className="h-8"
                  />
                </TableHead>
                <TableHead className="p-2"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Indlæser...
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Ingen resultater. Justér filtre eller søgning.
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((inspector, index) => (
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