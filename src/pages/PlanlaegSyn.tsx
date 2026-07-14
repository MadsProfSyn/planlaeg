import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  DragStartEvent,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { getMondayItems, getRegions, MondayItem } from "@/lib/supabase";
import { PlanlaegSynFiltersBar } from "@/components/planlaeg-syn/PlanlaegSynFiltersBar";
import { InspectionsPanel } from "@/components/planlaeg-syn/InspectionsPanel";
import { InspectorsPanel } from "@/components/planlaeg-syn/InspectorsPanel";
import { PlanlaegSynMapView } from "@/components/planlaeg-syn/PlanlaegSynMapView";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useRouteOptimizer } from "@/hooks/useRouteOptimizer";

export interface Inspector {
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
  notes?: string | null;
  // Booked shifts data from fetch-available-inspectors
  scheduled_shifts?: number;
  shift_details?: Array<{
    type: string;
    start_time: string;
    end_time: string;
    duration_minutes: number;
    address?: string;
    lat?: number;
    lng?: number;
  }>;
}

// Drag preview component
function DragPreview({ count }: { count: number }) {
  return (
    <div className="bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg text-sm font-medium pointer-events-none">
      {count} synsopgave{count !== 1 ? "r" : ""}
    </div>
  );
}

export default function PlanlaegSyn() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [selectedLandsdel, setSelectedLandsdel] = useState<string>("all");
  const [selectedAfdeling, setSelectedAfdeling] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"plan" | "map">("plan");
  const [selectedInspectionIds, setSelectedInspectionIds] = useState<number[]>([]);
  const [selectedInspectorId, setSelectedInspectorId] = useState<string | null>(null);

  // NEW assignments state (drag-dropped by user)
  const [newAssignments, setNewAssignments] = useState<Map<string, MondayItem[]>>(new Map());

  // Scheduled times state: inspectionId -> { start, end }
  const [scheduledTimes, setScheduledTimes] = useState<Map<number, { start: string; end: string }>>(new Map());
  
  // Track which inspection IDs have been manually edited (to protect from VRP auto-overwrite)
  const [manualTimeOverrides, setManualTimeOverrides] = useState<Set<number>>(new Set());

  // Sending state
  const [isSending, setIsSending] = useState(false);

  // Pending sent assignments (optimistic - shown as "B" items while background send runs)
  const [pendingSentAssignments, setPendingSentAssignments] = useState<Map<string, MondayItem[]>>(new Map());
  // Store scheduled times for pending items (needed for error recovery)
  const [pendingScheduledTimes, setPendingScheduledTimes] = useState<Map<number, { start: string; end: string }>>(new Map());

  // Syncing shifts state
  const [isSyncing, setIsSyncing] = useState(false);

  // Handler for user-initiated time edits (from ScheduleTimesDialog) - marks items as manually edited
  const handleUserScheduledTimes = useCallback((newTimes: Map<number, { start: string; end: string }>) => {
    setScheduledTimes((prev) => {
      const next = new Map(prev);
      newTimes.forEach((value, key) => next.set(key, value));
      return next;
    });
    // Mark all edited IDs as manual overrides
    setManualTimeOverrides((prev) => {
      const next = new Set(prev);
      newTimes.forEach((_, key) => next.add(key));
      return next;
    });
  }, []);
  
  // Handler for auto-applied times (from VRP) - skips items that have been manually edited
  // forceIds: IDs that should bypass the manualTimeOverrides guard (e.g. after reorder clear)
  const handleAutoScheduledTimes = useCallback((newTimes: Map<number, { start: string; end: string }>, forceIds?: number[]) => {
    const forceSet = forceIds ? new Set(forceIds) : null;
    setScheduledTimes((prev) => {
      const next = new Map(prev);
      newTimes.forEach((value, key) => {
        // Apply if forced or not manually overridden
        if (forceSet?.has(key) || !manualTimeOverrides.has(key)) {
          console.log(`🕐 autoSchedule applying id=${key} start=${value.start} end=${value.end} forced=${!!forceSet?.has(key)}`);
          next.set(key, value);
        } else {
          console.log(`🚫 autoSchedule BLOCKED id=${key} by manualTimeOverrides`);
        }
      });
      return next;
    });
  }, [manualTimeOverrides]);

  // Handler for clearing manual overrides (used by reset order)
  const handleClearManualOverrides = useCallback((ids: number[]) => {
    setManualTimeOverrides((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  // Configure sensors with distance constraint to prevent clicks from triggering drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Must drag 8px before drag activates
      },
    }),
  );

  // Drag state
  const [activeDragId, setActiveDragId] = useState<number | null>(null);

  // Fetch existing scheduled inspections that are NOT yet in WorkFeed
  // Items with wf_shift_id are already synced to supabase_shifts and show as "B" items
  const { data: existingScheduledData = [] } = useQuery({
    queryKey: ["existing-scheduled-inspections", selectedDate],
    queryFn: async () => {
      if (!selectedDate) return [];

      // Fetch monday items that are scheduled but NOT yet in WorkFeed
      const { data: mondayItems, error } = await supabase
        .from("monday_items_selected")
        .select("*")
        .eq("scheduled_date", selectedDate)
        .in("schedule_status", ["sent_to_workfeed", "scheduled_in_monday"])
        .not("scheduled_inspector_id", "is", null)
        .is("wf_shift_id", null); // Only items NOT yet in WorkFeed

      if (error) throw error;

      // Return items sorted by start time
      return (mondayItems || []).sort((a, b) =>
        (a.scheduled_start_time || "").localeCompare(b.scheduled_start_time || ""),
      );
    },
    enabled: !!selectedDate,
  });

  // Build Map of inspector → existing (already scheduled) inspections
  const existingAssignments = useMemo(() => {
    const map = new Map<string, MondayItem[]>();
    (existingScheduledData || []).forEach((item) => {
      const inspectorId = item.scheduled_inspector_id;
      if (inspectorId) {
        const existing = map.get(inspectorId) || [];
        existing.push(item as MondayItem);
        map.set(inspectorId, existing);
      }
    });
    return map;
  }, [existingScheduledData]);

  // Fetch landsdele (regions) for inspections filter
  const { data: landsdele = [] } = useQuery({
    queryKey: ["regions"],
    queryFn: getRegions,
  });

  // Fetch afdelinger (departments) for inspectors filter
  const { data: afdelinger = [] } = useQuery({
    queryKey: ["planlaeg-departments"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("fetch-departments");
      return (data?.data || []).map((d: { value: string }) => d.value);
    },
  });

  // Fetch inspections - all unscheduled by default, with optional date/landsdel filters
  const { data: inspectionsData, isLoading: isLoadingInspections } = useQuery({
    queryKey: ["planlaeg-inspections", selectedDate, selectedLandsdel],
    queryFn: async () => {
      const filters: { dateFrom?: string; dateTo?: string; regions?: string[] } = {};

      // Only apply date filter if a date is selected
      if (selectedDate) {
        filters.dateFrom = selectedDate;
        filters.dateTo = selectedDate;
      }

      // Filter by landsdel directly (Sjælland, Fyn, Jylland)
      if (selectedLandsdel !== "all") {
        filters.regions = [selectedLandsdel];
      }

      return getMondayItems(1, 500, filters);
    },
  });

  // Realtime subscription: auto-refresh when new inspections arrive from Monday.com
  useEffect(() => {
    const channel = supabase
      .channel("planlaeg-syn-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "monday_items_selected" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["planlaeg-inspections"] });
          queryClient.invalidateQueries({ queryKey: ["existing-scheduled-inspections"] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Fetch inspectors for the selected date and afdeling — direct DB queries (no Edge Function)
  const { data: inspectorsData, isLoading: isLoadingInspectors } = useQuery({
    queryKey: ["planlaeg-inspectors", selectedDate, selectedAfdeling],
    queryFn: async () => {
      if (!selectedDate) return { data: [] };

      // 1. Query availability directly
      let availQuery = supabase
        .from("supabase_availability")
        .select("*")
        .eq("is_available", true)
        .eq("date_local", selectedDate);

      if (selectedAfdeling !== "all") {
        availQuery = availQuery.eq("department", selectedAfdeling);
      }

      const { data: availData, error: availError } = await availQuery;
      if (availError) throw availError;
      if (!availData?.length) return { data: [] };

      const inspectorIds = [...new Set(availData.map(r => r.inspector_id))];

      // 2. Parallel fetch: addresses+notes, skills, capacity
      const [addressRes, skillsRes, capacityRes] = await Promise.all([
        supabase.from("inspectors").select("id, address, notes, lat, lng").in("id", inspectorIds),
        supabase.from("inspector_skills").select("inspector_id, inspection_type").in("inspector_id", inspectorIds).eq("is_active", true),
        supabase.from("inspector_capacity_view").select("inspector_id, date_local, scheduled_shifts, shift_details, booked_minutes, remaining_minutes, capacity_status").in("inspector_id", inspectorIds).eq("date_local", selectedDate),
      ]);

      // 3. Build lookup maps
      const addressMap = new Map<string, string>();
      const notesMap = new Map<string, string | null>();
      const coordsMap = new Map<string, { lat: number; lng: number }>();
      (addressRes.data || []).forEach((i: any) => {
        addressMap.set(i.id, i.address || '');
        notesMap.set(i.id, i.notes || null);
        if (typeof i.lat === "number" && typeof i.lng === "number") {
          coordsMap.set(i.id, { lat: i.lat, lng: i.lng });
        }
      });

      const skillsMap = new Map<string, string[]>();
      (skillsRes.data || []).forEach((s: any) => {
        if (!skillsMap.has(s.inspector_id)) skillsMap.set(s.inspector_id, []);
        skillsMap.get(s.inspector_id)!.push(s.inspection_type);
      });

      const capacityMap = new Map<string, any>();
      (capacityRes.data || []).forEach((c: any) => {
        capacityMap.set(c.inspector_id, {
          scheduled_shifts: c.scheduled_shifts || 0,
          shift_details: c.shift_details || [],
          booked_minutes: c.booked_minutes || 0,
          remaining_minutes: c.remaining_minutes,
          capacity_status: c.capacity_status,
        });
      });

      // 4. Transform to match expected UI format
      const transformedData = availData.map((row: any) => {
        const skills = skillsMap.get(row.inspector_id) || [];

        let tidspunkt_label = 'Hele dagen';
        if (row.start_time_local && row.end_time_local) {
          tidspunkt_label = `${row.start_time_local.substring(0, 5)} - ${row.end_time_local.substring(0, 5)}`;
        } else if (row.start_time_local) {
          tidspunkt_label = `Fra ${row.start_time_local.substring(0, 5)}`;
        } else if (row.end_time_local) {
          tidspunkt_label = `Til ${row.end_time_local.substring(0, 5)}`;
        }

        const cap = capacityMap.get(row.inspector_id) || {
          scheduled_shifts: 0, shift_details: [], booked_minutes: 0,
          remaining_minutes: null, capacity_status: null,
        };

        return {
          availability_id: row.id,
          inspector_uuid: row.inspector_id,
          navn: row.inspector_name,
          afdeling: row.department || '',
          synstyper: skills,
          adresse: addressMap.get(row.inspector_id) || '',
          notes: notesMap.get(row.inspector_id) || null,
          dato: row.date_local,
          start_tid: row.start_time_local,
          slut_tid: row.end_time_local,
          tidspunkt_label,
          scheduled_shifts: cap.scheduled_shifts,
          shift_details: cap.shift_details,
          booked_minutes: cap.booked_minutes,
          capacity_status: cap.capacity_status,
        };
      });

      return { data: transformedData, coords: coordsMap };
    },
    enabled: !!selectedDate,
  });

  const inspections = inspectionsData?.data || [];
  const inspectors: Inspector[] = inspectorsData?.data || [];
  const inspectorCoords: Map<string, { lat: number; lng: number }> =
    (inspectorsData as any)?.coords || new Map();

  // Build inspectorShiftDetails map from inspectors data (for route optimizer fixed_stops)
  const inspectorShiftDetails = useMemo(() => {
    const map = new Map<
      string,
      Array<{
        type: string;
        start_time: string;
        end_time: string;
        duration_minutes: number;
        address?: string;
        lat?: number;
        lng?: number;
      }>
    >();

    (inspectors || []).forEach((inspector) => {
      if (inspector.shift_details && inspector.shift_details.length > 0) {
        map.set(inspector.inspector_uuid, inspector.shift_details);
      }
    });

    return map;
  }, [inspectors]);

  // Route optimizer hook - triggers preview on assignment changes
  const {
    preview: routePreview,
    isPreviewLoading: isRouteLoading,
    error: routeError,
    getInspectorRoute,
  } = useRouteOptimizer({
    date: selectedDate || "",
    newAssignments,
    existingAssignments,
    inspectorShiftDetails,
    enabled: !!selectedDate && (newAssignments.size > 0 || existingAssignments.size > 0),
    debounceMs: 500,
  });
  // Combine existing + pending + new assignments for display (but keep them separate for sending)
  const combinedAssignments = useMemo(() => {
    const combined = new Map<string, MondayItem[]>();

    // Add existing assignments first
    existingAssignments.forEach((items, inspectorId) => {
      combined.set(inspectorId, [...items]);
    });

    // Add pending sent assignments (optimistic - treated like existing "B" items)
    pendingSentAssignments.forEach((items, inspectorId) => {
      const existing = combined.get(inspectorId) || [];
      combined.set(inspectorId, [...existing, ...items]);
    });

    // Add new assignments (append to existing for same inspector)
    newAssignments.forEach((items, inspectorId) => {
      const existing = combined.get(inspectorId) || [];
      combined.set(inspectorId, [...existing, ...items]);
    });

    return combined;
  }, [existingAssignments, pendingSentAssignments, newAssignments]);

  // Compute assigned inspection IDs - hide both existing and new assignments from left panel
  const assignedInspectionIds = useMemo(() => {
    const ids = new Set<number>();
    combinedAssignments.forEach((items) => {
      items.forEach((item) => ids.add(item.id));
    });
    return ids;
  }, [combinedAssignments]);

  // Count NEW assignments only (for sending)
  const totalNewAssignments = useMemo(() => {
    return Array.from(newAssignments.values()).reduce((acc, items) => acc + items.length, 0);
  }, [newAssignments]);

  // Count existing assignments
  const totalExistingAssignments = useMemo(() => {
    return Array.from(existingAssignments.values()).reduce((acc, items) => acc + items.length, 0);
  }, [existingAssignments]);

  // Check if any inspections are currently selected
  const hasSelectedInspections = selectedInspectionIds.length > 0;

  // Check all NEW assigned inspections have scheduled times
  const allNewAssignmentsHaveTimes = useMemo(() => {
    if (totalNewAssignments === 0) return false;
    for (const [_, items] of newAssignments) {
      for (const item of items) {
        if (!scheduledTimes.has(item.id)) return false;
      }
    }
    return true;
  }, [newAssignments, scheduledTimes, totalNewAssignments]);

  // Count for drag preview (selected items or 1 if dragging without selection)
  const dragCount = useMemo(() => {
    if (activeDragId === null) return 0;
    if (selectedInspectionIds.includes(activeDragId)) {
      return selectedInspectionIds.length;
    }
    return 1;
  }, [activeDragId, selectedInspectionIds]);

  const handleInspectionSelect = (id: number) => {
    setSelectedInspectionIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((i) => i !== id);
      }
      return [...prev, id];
    });
  };

  const assignInspectionsToInspector = (inspectorId: string, inspectionIdsToAssign: number[]) => {
    const inspectionsToAssign = inspections.filter((insp) => inspectionIdsToAssign.includes(insp.id));

    if (inspectionsToAssign.length === 0) return;

    setNewAssignments((prev) => {
      const next = new Map(prev);
      const existing = next.get(inspectorId) || [];

      // Add new inspections (avoid duplicates with both existing and new)
      const existingNewIds = new Set(existing.map((i) => i.id));
      const existingScheduledIds = new Set((existingAssignments.get(inspectorId) || []).map((i) => i.id));
      const newItems = inspectionsToAssign.filter((i) => !existingNewIds.has(i.id) && !existingScheduledIds.has(i.id));

      // Also remove from other inspectors (each inspection can only be assigned to one)
      next.forEach((items, key) => {
        if (key !== inspectorId) {
          next.set(
            key,
            items.filter((item) => !inspectionIdsToAssign.includes(item.id)),
          );
        }
      });

      next.set(inspectorId, [...existing, ...newItems]);
      return next;
    });

    // Clear selection after assignment
    setSelectedInspectionIds([]);
  };

  const handleInspectorSelect = (inspectorId: string) => {
    // If inspections are selected, assign them to this inspector
    if (selectedInspectionIds.length > 0) {
      assignInspectionsToInspector(inspectorId, selectedInspectionIds);
    } else {
      // No inspections selected - toggle inspector highlight
      setSelectedInspectorId((prev) => (prev === inspectorId ? null : inspectorId));
    }
  };

  // Only allow removing NEW assignments, not existing or pending ones
  const handleRemoveAssignment = (inspectorId: string, inspectionId: number) => {
    // Check if it's an existing assignment (cannot remove)
    const existingItems = existingAssignments.get(inspectorId) || [];
    if (existingItems.some((i) => i.id === inspectionId)) {
      toast.info("Eksisterende inspektioner kan ikke fjernes");
      return;
    }

    // Check if it's a pending sent assignment (cannot remove)
    const pendingItems = pendingSentAssignments.get(inspectorId) || [];
    if (pendingItems.some((i) => i.id === inspectionId)) {
      toast.info("Inspektionen sendes til WorkFeed...");
      return;
    }

    setNewAssignments((prev) => {
      const next = new Map(prev);
      const existing = next.get(inspectorId) || [];
      next.set(
        inspectorId,
        existing.filter((i) => i.id !== inspectionId),
      );
      return next;
    });

    // Clear stale scheduled times and manual overrides for the removed item
    setScheduledTimes((prev) => {
      const next = new Map(prev);
      next.delete(inspectionId);
      return next;
    });

    setManualTimeOverrides((prev) => {
      const next = new Set(prev);
      next.delete(inspectionId);
      return next;
    });
  };

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const inspectionId = Number(event.active.id.toString().replace("inspection-", ""));
    setActiveDragId(inspectionId);

    // If dragged item is not selected, select only it
    if (!selectedInspectionIds.includes(inspectionId)) {
      setSelectedInspectionIds([inspectionId]);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { over } = event;

    if (over && over.id.toString().startsWith("inspector-")) {
      const inspectorId = over.id.toString().replace("inspector-", "");
      assignInspectionsToInspector(inspectorId, selectedInspectionIds);
    } else {
      // Dropped on cancel zone or outside any valid target — clear selection
      setSelectedInspectionIds([]);
    }

    setActiveDragId(null);
  };

  // Handle manual sync of shifts AND availability from WorkFeed
  const handleSyncData = async () => {
    if (!selectedDate) {
      toast.error("Vælg en dato først");
      return;
    }

    setIsSyncing(true);
    try {
      const fromISO = new Date(selectedDate).toISOString();
      const toISO = new Date(selectedDate + "T23:59:59").toISOString();
      const sessionRes = await supabase.auth.getSession();
      const accessToken = sessionRes.data.session?.access_token;

      const [shiftsRes, availRes] = await Promise.allSettled([
        supabase.functions.invoke("sync-workfeed-shifts", {
          body: { startDate: selectedDate, endDate: selectedDate },
        }),
        fetch(
          `https://wtkyxxfeubpadivllowr.supabase.co/functions/v1/workfeed-ingest-availability?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          },
        ).then(async (r) => {
          if (!r.ok) throw new Error(await r.text());
          return r.json();
        }),
      ]);

      let shiftsCount: number | null = null;
      let availCount: number | null = null;
      const errors: string[] = [];

      if (shiftsRes.status === "fulfilled" && !shiftsRes.value.error) {
        shiftsCount = shiftsRes.value.data?.synced ?? 0;
      } else {
        errors.push("vagter");
        console.error("Shift sync error:", shiftsRes);
      }

      if (availRes.status === "fulfilled") {
        availCount = availRes.value?.upserted ?? 0;
      } else {
        errors.push("tilgængelighed");
        console.error("Availability sync error:", availRes.reason);
      }

      if (errors.length === 0) {
        toast.success(`Synkroniseret ${shiftsCount} vagter og ${availCount} tilgængelighedsposter`);
      } else if (errors.length === 2) {
        toast.error("Fejl ved synkronisering");
      } else {
        toast.warning(`Delvis sync – fejl ved: ${errors.join(", ")}`);
      }

      queryClient.invalidateQueries({ queryKey: ["existing-scheduled-inspections", selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["planlaeg-inspectors"] });
    } catch (err) {
      console.error("Sync error:", err);
      toast.error("Fejl ved synkronisering");
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle sending to WorkFeed - ONLY send NEW assignments (optimistic UI)
  const handleSendToWorkfeed = () => {
    // Validate all NEW assignments have times
    const missingTimes: string[] = [];
    newAssignments.forEach((items) => {
      items.forEach((item) => {
        if (!scheduledTimes.has(item.id)) {
          missingTimes.push(item.adresse || `ID ${item.id}`);
        }
      });
    });

    if (missingTimes.length > 0) {
      toast.error("Alle nye inspektioner skal have et tidspunkt");
      return;
    }

    if (!selectedDate) {
      toast.error("Vælg en dato først");
      return;
    }

    if (totalNewAssignments === 0) {
      toast.info("Ingen nye inspektioner at sende");
      return;
    }

    // Build payload with ONLY new assignments
    const payload = {
      assignments: [] as {
        monday_item_id: number;
        inspector_id: string;
        start_time: string;
        end_time: string;
        date: string;
      }[],
    };

    newAssignments.forEach((items, inspectorId) => {
      items.forEach((item) => {
        const times = scheduledTimes.get(item.id)!;
        payload.assignments.push({
          monday_item_id: item.id,
          inspector_id: inspectorId,
          start_time: times.start,
          end_time: times.end,
          date: selectedDate,
        });
      });
    });

    // Capture current state for optimistic update and potential rollback
    const sentAssignments = new Map(newAssignments);
    const sentScheduledTimes = new Map<number, { start: string; end: string }>();
    newAssignments.forEach((items) => {
      items.forEach((item) => {
        const times = scheduledTimes.get(item.id);
        if (times) sentScheduledTimes.set(item.id, times);
      });
    });
    const sendCount = totalNewAssignments;
    const sendDate = selectedDate;

    // OPTIMISTIC: Move items to pending, clear new assignments, unlock UI immediately
    setPendingSentAssignments(sentAssignments);
    setPendingScheduledTimes(sentScheduledTimes);
    setNewAssignments(new Map());
    setScheduledTimes(new Map());
    setSelectedInspectionIds([]);
    setIsSending(false);

    toast.info(`Sender ${sendCount} inspektion${sendCount !== 1 ? "er" : ""} til WorkFeed...`);

    // Fire edge function in background (non-blocking)
    supabase.functions.invoke("send-manual-shifts-to-workfeed", { body: payload })
      .then(async ({ data, error }) => {
        if (error) {
          console.error("Edge function error:", error);
          throw new Error("Edge function error");
        }

        if (!data?.success && data?.failed > 0) {
          toast.error(`${data.failed} inspektion${data.failed !== 1 ? "er" : ""} fejlede`);
        } else {
          toast.success(
            `${data.sent} ny${data.sent !== 1 ? "e" : ""} inspektion${data.sent !== 1 ? "er" : ""} sendt til WorkFeed`,
          );

          // Insert shifts locally into supabase_shifts for immediate visibility
          if (data.results && Array.isArray(data.results)) {
            const shiftsToInsert = data.results
              .filter((r: any) => r.success && r.wf_shift_id)
              .map((r: any) => {
                const assignment = payload.assignments.find((a) => a.monday_item_id === r.monday_item_id);
                const inspector = inspectors.find((i) => i.inspector_uuid === assignment?.inspector_id);

                return {
                  wf_shift_id: r.wf_shift_id,
                  wf_employee_id: r.wf_employee_id || "",
                  inspector_id: assignment?.inspector_id || "",
                  inspector_name: inspector?.navn || "",
                  department: inspector?.afdeling || "Unknown",
                  type: "Syn",
                  status: "RELEASED",
                  date_local: sendDate,
                  start_time_local: assignment?.start_time || null,
                  end_time_local: assignment?.end_time || null,
                  wf_role_id: r.wf_role_id || null,
                  inspection_queue_id: null,
                  sync_status: "synced",
                };
              });

            if (shiftsToInsert.length > 0) {
              const { error: insertError } = await supabase.from("supabase_shifts").insert(shiftsToInsert);
              if (insertError) {
                console.warn("Failed to insert shifts locally (will sync later):", insertError);
              }
            }
          }
        }

        // Clear pending state and refresh queries
        setPendingSentAssignments(new Map());
        setPendingScheduledTimes(new Map());
        queryClient.invalidateQueries({ queryKey: ["planlaeg-inspections"] });
        queryClient.invalidateQueries({ queryKey: ["existing-scheduled-inspections"] });
        queryClient.invalidateQueries({ queryKey: ["planlaeg-inspectors"] });

        // Background sync - fire and forget
        supabase.functions.invoke("sync-workfeed-shifts", {
          body: { startDate: sendDate, endDate: sendDate },
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ["planlaeg-inspectors"] });
        }).catch((syncError) => {
          console.warn("Background sync failed:", syncError);
        });
      })
      .catch((err) => {
        console.error("Send to WorkFeed error:", err);
        toast.error("Fejl ved afsendelse til WorkFeed. Inspektioner er gendannet.");

        // ROLLBACK: Move pending items back to new assignments
        setNewAssignments((prev) => {
          const next = new Map(prev);
          sentAssignments.forEach((items, inspectorId) => {
            const existing = next.get(inspectorId) || [];
            next.set(inspectorId, [...existing, ...items]);
          });
          return next;
        });
        setScheduledTimes((prev) => {
          const next = new Map(prev);
          sentScheduledTimes.forEach((value, key) => next.set(key, value));
          return next;
        });
        setPendingSentAssignments(new Map());
        setPendingScheduledTimes(new Map());
      });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden px-6 lg:px-8">
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-2xl font-bold text-foreground">Planlæg syn</h1>
        <p className="text-muted-foreground">Tildel synsopgaver til tilgængelige konsulenter</p>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap flex-shrink-0">
        <PlanlaegSynFiltersBar
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          selectedLandsdel={selectedLandsdel}
          onLandsdelChange={setSelectedLandsdel}
          selectedAfdeling={selectedAfdeling}
          onAfdelingChange={setSelectedAfdeling}
          landsdele={landsdele}
          afdelinger={afdelinger}
        />

        <div className="flex items-center gap-2">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "plan" | "map")}>
            <TabsList>
              <TabsTrigger value="plan">Planlægning</TabsTrigger>
              <TabsTrigger value="map">Kort</TabsTrigger>
            </TabsList>
          </Tabs>

          {selectedDate && (
            <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncData}
              disabled={isSyncing}
              title="Synkroniser vagter og tilgængelighed fra WorkFeed for denne dato"
            >
              {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2 hidden sm:inline">Sync data</span>
            </Button>

            {totalNewAssignments > 0 && (
              <Button size="sm" onClick={handleSendToWorkfeed} disabled={isSending || !allNewAssignmentsHaveTimes}>
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sender...
                  </>
                ) : (
                  `Send ${totalNewAssignments} ny${totalNewAssignments !== 1 ? "e" : ""} til WorkFeed`
                )}
              </Button>
            )}
            </>
          )}
        </div>
      </div>

      {activeTab === "plan" ? (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-2 gap-6 flex-1 min-h-0 mt-4 min-w-0 overflow-hidden" style={{ gridTemplateRows: 'minmax(0, 1fr)' }}>
          <div className="overflow-hidden min-h-0 h-full">
            <InspectionsPanel
              inspections={inspections}
              isLoading={isLoadingInspections}
              selectedIds={selectedInspectionIds}
              onSelect={handleInspectionSelect}
              hiddenIds={assignedInspectionIds}
              isDragActive={activeDragId !== null}
            />
          </div>
          <div className="overflow-hidden min-h-0 h-full">
          <InspectorsPanel
            inspectors={inspectors}
            isLoading={isLoadingInspectors}
            selectedId={selectedInspectorId}
            onSelect={handleInspectorSelect}
            assignments={combinedAssignments}
            existingAssignments={(() => {
              // Merge existingAssignments + pendingSentAssignments for "non-removable" display
              const merged = new Map(existingAssignments);
              pendingSentAssignments.forEach((items, inspectorId) => {
                const existing = merged.get(inspectorId) || [];
                merged.set(inspectorId, [...existing, ...items]);
              });
              return merged;
            })()}
            onRemoveAssignment={handleRemoveAssignment}
            hasSelectedInspections={hasSelectedInspections}
            scheduledTimes={(() => {
              // Merge scheduledTimes + pendingScheduledTimes
              const merged = new Map(scheduledTimes);
              pendingScheduledTimes.forEach((value, key) => merged.set(key, value));
              return merged;
            })()}
            onUpdateScheduledTimes={handleUserScheduledTimes}
            onAutoScheduledTimes={handleAutoScheduledTimes}
            getInspectorRoute={getInspectorRoute}
            isRouteLoading={isRouteLoading}
            selectedDate={selectedDate || ""}
            onClearManualOverrides={handleClearManualOverrides}
            existingAssignmentsMap={existingAssignments}
            inspectorShiftDetails={inspectorShiftDetails}
          />
          </div>
        </div>

        <DragOverlay>{activeDragId !== null && <DragPreview count={dragCount} />}</DragOverlay>
      </DndContext>
      ) : (
        <div className="flex-1 min-h-0 mt-4 overflow-hidden">
          <PlanlaegSynMapView
            selectedDate={selectedDate}
            inspections={inspections}
            inspectors={inspectors}
            inspectorCoords={inspectorCoords}
          />
        </div>
      )}
    </div>
  );
}
