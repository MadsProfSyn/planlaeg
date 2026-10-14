import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Pencil, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Checkbox } from "@/components/ui/checkbox";
import { MondayItem } from "@/lib/supabase";
import { getEffectiveDuration } from "@/lib/inspection-duration";

export type AlleSynSortField =
  | "Kunde"
  | "adresse"
  | "synstype"
  | "dato_tid"
  | "antal_vaerelser"
  | "note"
  | "duration_minutes";

export type SortDir = "asc" | "desc";

interface AlleSynTableProps {
  items: MondayItem[];
  isLoading: boolean;
  onEdit: (item: MondayItem) => void;
  onDelete: (id: number) => void;
  sortField: AlleSynSortField;
  sortDir: SortDir;
  onSort: (field: AlleSynSortField) => void;
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: (checked: boolean) => void;
}

function extractNote(item: MondayItem): string {
  if ((item as any).note) return (item as any).note;
  if (!item.raw) return "";
  const data = typeof item.raw === "string" ? JSON.parse(item.raw) : item.raw;
  return data?.Note || "";
}

function getDisplayDuration(item: MondayItem): { value: number; isManual: boolean; isAuto: boolean } {
  if ((item as any).duration_minutes != null) {
    return { value: (item as any).duration_minutes, isManual: true, isAuto: false };
  }
  return { value: getEffectiveDuration(item), isManual: false, isAuto: true };
}

function SortHeader({
  label,
  field,
  sortField,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  field: AlleSynSortField;
  sortField: AlleSynSortField;
  sortDir: SortDir;
  onSort: (field: AlleSynSortField) => void;
  className?: string;
}) {
  const active = sortField === field;
  const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`inline-flex items-center gap-1 select-none hover:text-foreground transition-colors ${
        active ? "text-foreground" : "text-muted-foreground"
      } ${className ?? ""}`}
    >
      <span>{label}</span>
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

export function AlleSynTable({ items, isLoading, onEdit, onDelete, sortField, sortDir, onSort, selectedIds, onToggle, onToggleAll }: AlleSynTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {["", "Kunde", "Adresse", "Synstype", "Dato/tid", "Værelser", "Note", "Varighed", ""].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 9 }).map((_, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        Ingen synsopgaver fundet.
      </div>
    );
  }

  const selectedOnPage = items.filter((i) => selectedIds.has(i.id)).length;
  const allSelected = items.length > 0 && selectedOnPage === items.length;
  const someSelected = selectedOnPage > 0 && !allSelected;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={(v) => onToggleAll(v === true)}
                aria-label="Vælg alle på siden"
              />
            </TableHead>
            <TableHead><SortHeader label="Kunde" field="Kunde" sortField={sortField} sortDir={sortDir} onSort={onSort} /></TableHead>
            <TableHead><SortHeader label="Adresse" field="adresse" sortField={sortField} sortDir={sortDir} onSort={onSort} /></TableHead>
            <TableHead><SortHeader label="Synstype" field="synstype" sortField={sortField} sortDir={sortDir} onSort={onSort} /></TableHead>
            <TableHead><SortHeader label="Dato/tid" field="dato_tid" sortField={sortField} sortDir={sortDir} onSort={onSort} /></TableHead>
            <TableHead className="text-center"><SortHeader label="Værelser" field="antal_vaerelser" sortField={sortField} sortDir={sortDir} onSort={onSort} /></TableHead>
            <TableHead><SortHeader label="Note" field="note" sortField={sortField} sortDir={sortDir} onSort={onSort} /></TableHead>
            <TableHead className="text-center"><SortHeader label="Varighed" field="duration_minutes" sortField={sortField} sortDir={sortDir} onSort={onSort} /></TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const note = extractNote(item);
            const dur = getDisplayDuration(item);
            return (
              <TableRow key={item.id} className={selectedIds.has(item.id) ? "bg-muted/50" : undefined}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(item.id)}
                    onCheckedChange={() => onToggle(item.id)}
                    aria-label="Vælg syn"
                  />
                </TableCell>
                <TableCell className="font-medium max-w-[140px] truncate">{item.Kunde || "—"}</TableCell>
                <TableCell className="max-w-[200px] truncate">{item.adresse || "—"}</TableCell>
                <TableCell>{item.synstype || "—"}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {item.dato_tid
                    ? format(new Date(item.dato_tid), "dd. MMM yyyy", { locale: da })
                    : "—"}
                </TableCell>
                <TableCell className="text-center">{item.antal_vaerelser ?? "—"}</TableCell>
                <TableCell className="max-w-[160px] truncate" title={note}>{note || "—"}</TableCell>
                <TableCell className="text-center whitespace-nowrap">
                  {dur.value} min
                  {dur.isManual ? (
                    <Badge variant="outline" className="ml-1 text-xs font-normal text-amber-600 border-amber-400/40 italic">Manuel</Badge>
                  ) : (
                    <Badge variant="outline" className="ml-1 text-xs font-normal">auto</Badge>
                  )}
                </TableCell>
                <TableCell className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="hover:bg-destructive/10" onClick={() => onDelete(item.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
