import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, SkipForward, Minus } from "lucide-react";

export interface SmsHistoryEntry {
  id: string;
  inspector_id: string;
  inspector_name: string;
  phone: string | null;
  target_date: string;
  sent_at: string;
  status: "sent" | "failed" | "skipped";
  failure_reason: string | null;
  current_availability_status: string | null;
  result: "action_taken" | "no_action" | "not_applicable";
}

interface SmsHistoryTableProps {
  data: SmsHistoryEntry[];
  isLoading: boolean;
}

export function SmsHistoryTable({ data, isLoading }: SmsHistoryTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Navn</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>SMS Status</TableHead>
              <TableHead>Nuværende status</TableHead>
              <TableHead>Resultat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                <TableCell><Skeleton className="h-6 w-28" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-muted-foreground">Ingen SMS påmindelser fundet for den valgte dato.</p>
      </div>
    );
  }

  const renderSmsStatus = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <Badge variant="default" className="bg-green-600 hover:bg-green-700">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Sendt
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Fejlet
          </Badge>
        );
      case "skipped":
        return (
          <Badge variant="secondary">
            <SkipForward className="h-3 w-3 mr-1" />
            Sprunget over
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const renderAvailabilityStatus = (status: string | null) => {
    if (!status) {
      return <span className="text-muted-foreground">-</span>;
    }

    switch (status) {
      case "AVAILABLE":
        return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Tilgængelig</Badge>;
      case "NOT_AVAILABLE":
        return <Badge variant="secondary">Ikke tilgængelig</Badge>;
      case "NO_RESPONSE":
        return <Badge variant="outline" className="text-amber-600 border-amber-600">Ingen svar</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const renderResult = (result: string, smsStatus: string) => {
    if (smsStatus !== "sent") {
      return <span className="text-muted-foreground flex items-center"><Minus className="h-4 w-4" /></span>;
    }

    switch (result) {
      case "action_taken":
        return (
          <Badge variant="default" className="bg-green-600 hover:bg-green-700">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Handling taget
          </Badge>
        );
      case "no_action":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Ingen reaktion
          </Badge>
        );
      default:
        return <span className="text-muted-foreground">-</span>;
    }
  };

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Navn</TableHead>
            <TableHead>Telefon</TableHead>
            <TableHead>SMS Status</TableHead>
            <TableHead>Nuværende status</TableHead>
            <TableHead>Resultat</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="font-medium">{entry.inspector_name}</TableCell>
              <TableCell>{entry.phone || <span className="text-muted-foreground">-</span>}</TableCell>
              <TableCell>{renderSmsStatus(entry.status)}</TableCell>
              <TableCell>{renderAvailabilityStatus(entry.current_availability_status)}</TableCell>
              <TableCell>{renderResult(entry.result, entry.status)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
