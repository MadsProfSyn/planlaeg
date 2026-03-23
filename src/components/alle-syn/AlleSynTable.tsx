import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Pencil, Trash2 } from "lucide-react";
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
import { MondayItem } from "@/lib/supabase";
import { getEffectiveDuration } from "@/lib/inspection-duration";

interface AlleSynTableProps {
  items: MondayItem[];
  isLoading: boolean;
  onEdit: (item: MondayItem) => void;
  onDelete: (id: number) => void;
}

function extractNote(item: MondayItem): string {
  if ((item as any).note) return (item as any).note;
  if (!item.raw) return "";
  const data = typeof item.raw === "string" ? JSON.parse(item.raw) : item.raw;
  return data?.Note || "";
}

function getDisplayDuration(item: MondayItem): { value: number; isAuto: boolean } {
  if ((item as any).duration_minutes != null) {
    return { value: (item as any).duration_minutes, isAuto: false };
  }
  return { value: getEffectiveDuration(item), isAuto: true };
}

export function AlleSynTable({ items, isLoading, onEdit, onDelete }: AlleSynTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {["Kunde", "Adresse", "Synstype", "Dato/tid", "Værelser", "Note", "Varighed", ""].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 8 }).map((_, j) => (
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

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kunde</TableHead>
            <TableHead>Adresse</TableHead>
            <TableHead>Synstype</TableHead>
            <TableHead>Dato/tid</TableHead>
            <TableHead className="text-center">Værelser</TableHead>
            <TableHead>Note</TableHead>
            <TableHead className="text-center">Varighed</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const note = extractNote(item);
            const dur = getDisplayDuration(item);
            return (
              <TableRow key={item.id}>
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
                  {dur.isAuto && (
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
