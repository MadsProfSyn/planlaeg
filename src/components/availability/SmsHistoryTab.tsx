import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SmsHistoryFiltersBar } from "./SmsHistoryFiltersBar";
import { SmsHistoryTable, type SmsHistoryEntry } from "./SmsHistoryTable";

interface SmsHistoryTabProps {
  initialDate?: string;
}

export function SmsHistoryTab({ initialDate }: SmsHistoryTabProps) {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = React.useState(initialDate || new Date().toISOString().split("T")[0]);
  const [data, setData] = React.useState<SmsHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const fetchSmsHistory = React.useCallback(async (targetDate: string) => {
    setIsLoading(true);
    try {
      // Fetch SMS logs for the selected target_date
      const { data: smsLogs, error: logsError } = await supabase
        .from("sms_reminder_logs")
        .select("*")
        .eq("target_date", targetDate)
        .order("sent_at", { ascending: false });

      if (logsError) throw logsError;

      if (!smsLogs || smsLogs.length === 0) {
        setData([]);
        return;
      }

      // Get unique inspector IDs to fetch their current availability
      const inspectorIds = [...new Set(smsLogs.map((log) => log.inspector_id))];

      // Fetch availability status for these inspectors on the target date
      const { data: availabilityData, error: availError } = await supabase
        .from("supabase_availability")
        .select("inspector_id, availability_status")
        .eq("date_local", targetDate)
        .in("inspector_id", inspectorIds);

      if (availError) {
        console.warn("Error fetching availability:", availError);
      }

      // Create a map of inspector availability
      const availabilityMap = new Map<string, string>();
      availabilityData?.forEach((item) => {
        availabilityMap.set(item.inspector_id, item.availability_status || "NO_RESPONSE");
      });

      // Map SMS logs to history entries with availability status
      const historyEntries: SmsHistoryEntry[] = smsLogs.map((log) => {
        const currentStatus = availabilityMap.get(log.inspector_id) || "NO_RESPONSE";
        
        // Determine result based on SMS status and current availability
        let result: "action_taken" | "no_action" | "not_applicable" = "not_applicable";
        if (log.status === "sent") {
          if (currentStatus === "AVAILABLE" || currentStatus === "NOT_AVAILABLE") {
            result = "action_taken";
          } else {
            result = "no_action";
          }
        }

        return {
          id: log.id,
          inspector_id: log.inspector_id,
          inspector_name: log.inspector_name,
          phone: log.phone,
          target_date: log.target_date,
          sent_at: log.sent_at,
          status: log.status as "sent" | "failed" | "skipped",
          failure_reason: log.failure_reason,
          current_availability_status: currentStatus,
          result,
        };
      });

      setData(historyEntries);
    } catch (error) {
      console.error("Failed to fetch SMS history:", error);
      toast({
        title: "Fejl",
        description: "Kunne ikke hente SMS historik",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Auto-fetch on mount and when date changes
  React.useEffect(() => {
    fetchSmsHistory(selectedDate);
  }, [selectedDate, fetchSmsHistory]);

  const handleReset = () => {
    const today = new Date().toISOString().split("T")[0];
    setSelectedDate(today);
    fetchSmsHistory(today);
  };

  return (
    <div>
      <SmsHistoryFiltersBar
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onSearch={() => fetchSmsHistory(selectedDate)}
        onReset={handleReset}
        isLoading={isLoading}
      />

      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          Viser SMS påmindelser sendt for dato: <strong>{new Date(selectedDate).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" })}</strong>
        </p>
        {data.length > 0 && (
          <p className="text-sm text-muted-foreground mt-1">
            {data.filter(d => d.status === "sent").length} sendt, {data.filter(d => d.result === "action_taken").length} reagerede, {data.filter(d => d.result === "no_action").length} ingen reaktion
          </p>
        )}
      </div>

      <SmsHistoryTable data={data} isLoading={isLoading} />
    </div>
  );
}
