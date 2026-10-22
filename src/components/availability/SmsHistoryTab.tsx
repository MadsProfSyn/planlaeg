import * as React from "react";
import { format, subDays, addDays, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SmsHistoryFiltersBar, type SmsHistoryFilters } from "./SmsHistoryFiltersBar";
import { SmsHistoryTable, getResponseState, type SmsHistoryEntry } from "./SmsHistoryTable";

const defaultFilters = (): SmsHistoryFilters => ({
  sentFrom: format(subDays(new Date(), 30), "yyyy-MM-dd"),
  sentTo: format(new Date(), "yyyy-MM-dd"),
  targetDate: undefined,
  search: "",
});

export function SmsHistoryTab() {
  const { toast } = useToast();
  const [filters, setFilters] = React.useState<SmsHistoryFilters>(defaultFilters);
  const [data, setData] = React.useState<SmsHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const fetchSmsHistory = React.useCallback(
    async (f: SmsHistoryFilters) => {
      setIsLoading(true);
      try {
        let q = supabase.from("sms_reminder_logs").select("*").order("sent_at", { ascending: false });
        if (f.targetDate) {
          q = q.eq("target_date", f.targetDate);
        } else {
          const from = parseISO(f.sentFrom);
          const toExclusive = addDays(parseISO(f.sentTo), 1);
          q = q.gte("sent_at", from.toISOString()).lt("sent_at", toExclusive.toISOString());
        }
        const { data: rows, error } = await q;
        if (error) throw error;
        setData((rows || []) as SmsHistoryEntry[]);
      } catch (error) {
        console.error("Failed to fetch SMS history:", error);
        toast({ title: "Fejl", description: "Kunne ikke hente SMS historik", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  React.useEffect(() => {
    fetchSmsHistory(filters);
    // search is filtered client-side
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.sentFrom, filters.sentTo, filters.targetDate, fetchSmsHistory]);

  const visible = React.useMemo(() => {
    const s = filters.search.trim().toLowerCase();
    return s ? data.filter((d) => d.inspector_name.toLowerCase().includes(s)) : data;
  }, [data, filters.search]);

  const today = format(new Date(), "yyyy-MM-dd");
  const sent = visible.filter((d) => d.status === "sent");
  const counts = sent.reduce(
    (acc, d) => {
      acc[getResponseState(d, today)]++;
      return acc;
    },
    { answered_yes: 0, answered_no: 0, pending: 0, none: 0 }
  );

  return (
    <div>
      <SmsHistoryFiltersBar
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters(defaultFilters())}
        isLoading={isLoading}
      />

      <p className="text-sm text-muted-foreground mb-4">
        {sent.length} SMS sendt · {counts.answered_yes + counts.answered_no} svarede · {counts.pending} afventer svar ·{" "}
        {counts.none} intet svar
      </p>

      <SmsHistoryTable data={visible} isLoading={isLoading} />
    </div>
  );
}
