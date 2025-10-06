import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { MondayItem } from "@/lib/supabase";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { useState } from "react";

interface MondayItemsTableProps {
  items: MondayItem[];
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  onEdit: (item: MondayItem) => void;
  onDelete: (id: number) => void;
  isLoading?: boolean;
  totalCount?: number;
}

type SortColumn = 'adresse' | 'synstype' | 'dato_tid' | 'antal_vaerelser' | 'Kunde' | 'landsdel';
type SortDirection = 'asc' | 'desc' | null;

export function MondayItemsTable({
  items,
  selectedIds,
  onSelectionChange,
  onEdit,
  onDelete,
  isLoading = false,
  totalCount = 0,
}: MondayItemsTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-2" />;
    }
    return sortDirection === 'asc' ? 
      <ArrowUp className="h-4 w-4 ml-2" /> : 
      <ArrowDown className="h-4 w-4 ml-2" />;
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(items.map((item) => item.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectRow = (id: number, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter((selectedId) => selectedId !== id));
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "Ikke angivet";
    try {
      const date = new Date(dateStr);
      return format(date, "dd-MM-yyyy", { locale: da });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">
          Ingen syn fundet
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Der er ingen syn, der matcher dine filtre
        </p>
      </div>
    );
  }

  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < items.length;

  // Sort items
  const sortedItems = [...items].sort((a, b) => {
    if (!sortColumn || !sortDirection) return 0;

    let aValue: any = a[sortColumn];
    let bValue: any = b[sortColumn];

    // Handle null/undefined values
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    // Special handling for dates
    if (sortColumn === 'dato_tid') {
      aValue = new Date(aValue).getTime();
      bValue = new Date(bValue).getTime();
    }

    // Special handling for numbers
    if (sortColumn === 'antal_vaerelser') {
      aValue = Number(aValue) || 0;
      bValue = Number(bValue) || 0;
    }

    // String comparison for other fields
    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                aria-label="Vælg alle syn"
                className={someSelected ? "data-[state=checked]:bg-primary" : ""}
              />
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('adresse')}
                className="h-8 px-2 lg:px-3 hover:bg-transparent"
              >
                Adresse
                {getSortIcon('adresse')}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('synstype')}
                className="h-8 px-2 lg:px-3 hover:bg-transparent"
              >
                Type
                {getSortIcon('synstype')}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('dato_tid')}
                className="h-8 px-2 lg:px-3 hover:bg-transparent"
              >
                Dato
                {getSortIcon('dato_tid')}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('antal_vaerelser')}
                className="h-8 px-2 lg:px-3 hover:bg-transparent"
              >
                Værelser
                {getSortIcon('antal_vaerelser')}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('Kunde')}
                className="h-8 px-2 lg:px-3 hover:bg-transparent"
              >
                Kunde
                {getSortIcon('Kunde')}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('landsdel')}
                className="h-8 px-2 lg:px-3 hover:bg-transparent"
              >
                Landsdel
                {getSortIcon('landsdel')}
              </Button>
            </TableHead>
            <TableHead className="w-24">Handlinger</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedItems.map((item) => (
            <TableRow
              key={item.id}
              className={selectedIds.includes(item.id) ? "bg-muted/50" : ""}
            >
              <TableCell>
                <Checkbox
                  checked={selectedIds.includes(item.id)}
                  onCheckedChange={(checked) =>
                    handleSelectRow(item.id, checked as boolean)
                  }
                  aria-label={`Vælg syn ${item.name || item.adresse}`}
                />
              </TableCell>
              <TableCell>{item.adresse || "-"}</TableCell>
              <TableCell>
                {item.synstype ? (
                  <Badge variant="outline">{item.synstype}</Badge>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell>{formatDateTime(item.dato_tid)}</TableCell>
              <TableCell>{item.antal_vaerelser || "-"}</TableCell>
              <TableCell>{item.Kunde || "-"}</TableCell>
              <TableCell>
                {item.landsdel ? (
                  <Badge variant="secondary">{item.landsdel}</Badge>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(item)}
                    aria-label="Rediger syn"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(item.id)}
                    aria-label="Slet syn"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
