import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { da } from "date-fns/locale";
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useSystemStatus, type SystemStatusLevel } from "@/hooks/useSystemStatus";

interface IntegrationEvent {
  id: string | number;
  source: string;
  action: string;
  ok: boolean;
  item_id: number | null;
  message: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  inserted: "Nyt syn oprettet",
  updated_existing: "Fandtes allerede – opdateret",
  updated_new_date: "Ny dato fra Monday",
  skipped_already_planned: "Allerede planlagt – sprunget over",
  skipped_duplicate: "Dublet afvist",
  error: "Fejl",
};

const DOT: Record<SystemStatusLevel, string> = {
  ok: "bg-green-500",
  warn: "bg-amber-500",
  error: "bg-red-500",
};

const BANNER: Record<SystemStatusLevel, { text: string; cls: string; Icon: typeof CheckCircle2 }> = {
  ok: { text: "Alt kører som det skal", cls: "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400", Icon: CheckCircle2 },
  warn: { text: "Der er advarsler – se nedenfor", cls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400", Icon: AlertTriangle },
  error: { text: "Noget kræver opmærksomhed – se nedenfor", cls: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400", Icon: XCircle },
};

export default function Systemstatus() {
  const { rows, worstStatus, isLoading, isFetching, dataUpdatedAt, refetch } = useSystemStatus();

  const eventsQuery = useQuery({
    queryKey: ["integration-events", "monday"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("integration_events")
        .select("*")
        .eq("source", "monday")
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return (data || []) as IntegrationEvent[];
    },
  });

  const handleRefresh = () => {
    refetch();
    eventsQuery.refetch();
  };

  const banner = BANNER[worstStatus];
  const events = eventsQuery.data ?? [];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Systemstatus</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overblik over forbindelserne til Monday, WorkFeed og ruteberegningen
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-muted-foreground">
              Opdateret kl. {format(new Date(dataUpdatedAt), "HH:mm")}
            </span>
          )}
          <Button variant="outline" onClick={handleRefresh} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
            Opdater
          </Button>
        </div>
      </div>

      {!isLoading && (
        <div className={cn("flex items-center gap-2 rounded-md border px-4 py-3 text-sm font-medium", banner.cls)}>
          <banner.Icon className="h-5 w-5" />
          {banner.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rows.map((row) => (
          <Card key={row.key}>
            <CardContent className="pt-6 space-y-1">
              <div className="flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", DOT[row.status] ?? "bg-muted")} />
                <span className="font-medium">{row.label}</span>
              </div>
              {row.last_at && (
                <p
                  className="text-sm"
                  title={format(new Date(row.last_at), "dd.MM.yyyy HH:mm")}
                >
                  Sidst: {formatDistanceToNow(new Date(row.last_at), { addSuffix: true, locale: da })}
                </p>
              )}
              {row.detail && <p className="text-sm text-muted-foreground">{row.detail}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seneste syn fra Monday (Zapier)</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {eventsQuery.isLoading ? "Indlæser..." : "Ingen hændelser endnu"}
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tidspunkt</TableHead>
                    <TableHead>Hændelse</TableHead>
                    <TableHead>Monday-ID</TableHead>
                    <TableHead>Besked</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((e) => (
                    <TableRow key={e.id} className={cn(!e.ok && "text-red-600 dark:text-red-400")}>
                      <TableCell className="py-2 whitespace-nowrap">{format(new Date(e.created_at), "dd.MM HH:mm")}</TableCell>
                      <TableCell className="py-2">{ACTION_LABELS[e.action] ?? e.action}</TableCell>
                      <TableCell className="py-2">{e.item_id ?? "-"}</TableCell>
                      <TableCell className="py-2">{e.message || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
