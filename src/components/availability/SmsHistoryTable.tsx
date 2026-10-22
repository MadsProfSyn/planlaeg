import { format, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface SmsHistoryEntry {
  id: string;
  inspector_id: string;
  inspector_name: string;
  phone: string | null;
  target_date: string;
  sent_at: string | null;
  status: string;
  failure_reason: string | null;
  message_preview: string | null;
  response_status: string | null;
  responded_at: string | null;
  sent_by_name: string | null;
}

export type ResponseState = "answered_yes" | "answered_no" | "pending" | "none";

export function getResponseState(e: SmsHistoryEntry, today: string): ResponseState {
  if (e.response_status === "AVAILABLE") return "answered_yes";
  if (e.response_status === "NOT_AVAILABLE") return "answered_no";
  return e.target_date >= today ? "pending" : "none";
}

const dkDateTime = (iso: string | null) => {
  if (!iso) return "—";
  const parts = new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("day")}. ${g("month").replace(/\.$/, "")}. ${g("hour")}:${g("minute")}`;
};

const smsBadge = (e: SmsHistoryEntry) => {
  const badge =
    e.status === "sent" ? (
      <Badge className="bg-green-500/10 text-green-700 border-green-500/20">Sendt</Badge>
    ) : e.status === "failed" ? (
      <Badge variant="destructive">Fejlet</Badge>
    ) : (
      <Badge variant="secondary">Sprunget over</Badge>
    );
  if (!e.failure_reason) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{badge}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{e.failure_reason}</TooltipContent>
    </Tooltip>
  );
};

const responseBadge = (state: ResponseState) => {
  switch (state) {
    case "answered_yes":
      return <Badge className="bg-green-500/10 text-green-700 border-green-500/20">Kan arbejde</Badge>;
    case "answered_no":
      return <Badge variant="secondary">Kan ikke</Badge>;
    case "pending":
      return <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20">Afventer svar</Badge>;
    default:
      return <Badge className="bg-red-500/10 text-red-700 border-red-500/20">Intet svar</Badge>;
  }
};

const headers = ["Sendt", "Navn", "Telefon", "Gælder dato", "SMS", "Svar", "Svar modtaget", "Sendt af"];

export function SmsHistoryTable({ data, isLoading }: { data: SmsHistoryEntry[]; isLoading: boolean }) {
  const today = format(new Date(), "yyyy-MM-dd");

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        Ingen SMS'er fundet for de valgte filtre.
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((h, i) => (
                <TableHead key={i}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((e) => (
              <TableRow key={e.id} title={e.message_preview || undefined}>
                <TableCell className="whitespace-nowrap">{dkDateTime(e.sent_at)}</TableCell>
                <TableCell className="font-medium">{e.inspector_name}</TableCell>
                <TableCell className="whitespace-nowrap">{e.phone || "—"}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {format(parseISO(e.target_date), "d. MMM yyyy", { locale: da })}
                </TableCell>
                <TableCell>{smsBadge(e)}</TableCell>
                <TableCell>{responseBadge(getResponseState(e, today))}</TableCell>
                <TableCell className="whitespace-nowrap">{dkDateTime(e.responded_at)}</TableCell>
                <TableCell>{e.sent_by_name || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
