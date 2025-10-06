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
import { Pencil, Trash2 } from "lucide-react";
import { MondayItem } from "@/lib/supabase";
import { format } from "date-fns";
import { da } from "date-fns/locale";

interface MondayItemsTableProps {
  items: MondayItem[];
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  onEdit: (item: MondayItem) => void;
  onDelete: (id: number) => void;
  isLoading?: boolean;
  totalCount?: number;
}

export function MondayItemsTable({
  items,
  selectedIds,
  onSelectionChange,
  onEdit,
  onDelete,
  isLoading = false,
  totalCount = 0,
}: MondayItemsTableProps) {
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
      return format(new Date(dateStr), "dd-MM-yyyy HH:mm", { locale: da });
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
            <TableHead>Navn</TableHead>
            <TableHead>Adresse</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Dato & Tid</TableHead>
            <TableHead>Værelser</TableHead>
            <TableHead>Kunde</TableHead>
            <TableHead>Landsdel</TableHead>
            <TableHead className="w-24">Handlinger</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
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
              <TableCell className="font-medium">{item.name || "-"}</TableCell>
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
