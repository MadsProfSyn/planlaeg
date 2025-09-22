import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShiftsFiltersBar } from "@/components/filters/ShiftsFiltersBar";
import { ShiftsTable } from "@/components/shifts/ShiftsTable";
import { ShiftsPagination } from "@/components/shifts/ShiftsPagination";
import { ShiftDetailModal } from "@/components/shifts/ShiftDetailModal";
import { getShifts, getShiftDepartments, getCanonicalRoles, Shift, ShiftFilters, SEED_SHIFTS } from "@/lib/shifts";
import { getCurrentDateForInput } from "@/lib/date-utils";
import { syncWorkfeedShifts, getTodayDateRange } from "@/lib/workfeed";
import { useToast } from "@/components/ui/use-toast";

export default function ScheduledShiftsPage() {
  const [currentPage, setCurrentPage] = React.useState(1);
  const [filters, setFilters] = React.useState<ShiftFilters>({
    dateFrom: getCurrentDateForInput(),
    dateTo: getCurrentDateForInput(),
  });
  const [selectedShift, setSelectedShift] = React.useState<Shift | null>(null);
  const [showDetailModal, setShowDetailModal] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const { toast } = useToast();

  // Fetch shifts
  const {
    data: shiftsResponse,
    isLoading: shiftsLoading,
    error: shiftsError,
  } = useQuery({
    queryKey: ["shifts", currentPage, filters],
    queryFn: () => getShifts(currentPage, 25, filters),
    retry: 1,
  });

  // Fetch departments for filter
  const { data: departments = [] } = useQuery({
    queryKey: ["shift-departments"],
    queryFn: getShiftDepartments,
    retry: 1,
  });

  const synsTypes = getCanonicalRoles();

  const handleSearch = () => {
    setCurrentPage(1);
  };

  const handleClearAll = () => {
    setFilters({
      dateFrom: getCurrentDateForInput(),
      dateTo: getCurrentDateForInput(),
    });
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    const data = shiftsResponse?.data || SEED_SHIFTS;
    const csvContent = [
      "Navn,Afdeling,Synstyper,Dato,Tidspunkt,Status",
      ...data.map(shift => [
        shift.inspector_name,
        shift.department,
        shift.type || shift.wf_role_id,
        shift.date_local,
        shift.start_utc && shift.end_utc 
          ? `${new Date(shift.start_utc).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}–${new Date(shift.end_utc).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}`
          : "All Day",
        shift.status || "Planlagt"
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planlagte-vagter-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleViewDetails = (shift: Shift) => {
    setSelectedShift(shift);
    setShowDetailModal(true);
  };

  const handleSyncShifts = async () => {
    setIsSyncing(true);
    try {
      // Use current filter date range or default to today
      const startFrom = filters.dateFrom ? `${filters.dateFrom}T00:00:00.000Z` : getTodayDateRange().startFrom;
      const startTo = filters.dateTo ? `${filters.dateTo}T23:59:59.999Z` : getTodayDateRange().startTo;
      
      const result = await syncWorkfeedShifts({ startFrom, startTo });
      
      if (result.success) {
        toast({
          title: "Sync Completed",
          description: `Successfully synced ${result.shifts} shifts from Workfeed`,
        });
        // Refetch data after successful sync
        window.location.reload(); // Simple way to refresh data
      } else {
        toast({
          title: "Sync Failed", 
          description: result.error || "Failed to sync shifts",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Sync Error",
        description: "An error occurred while syncing shifts",
        variant: "destructive", 
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Use fallback data on error
  const shifts = shiftsError ? SEED_SHIFTS : (shiftsResponse?.data || []);
  const totalCount = shiftsError ? SEED_SHIFTS.length : (shiftsResponse?.count || 0);
  const totalPages = shiftsError ? 1 : (shiftsResponse?.totalPages || 1);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Planlagte vagter</h1>
        <Button 
          onClick={handleSyncShifts}
          disabled={isSyncing}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync Workfeed'}
        </Button>
      </div>

      {shiftsError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            Kunne ikke hente vagter – viser eksempeldata. Fejl: {shiftsError.message}
          </p>
        </div>
      )}

      <ShiftsFiltersBar
        departments={departments}
        synsTypes={synsTypes}
        filters={filters}
        onFiltersChange={setFilters}
        onSearch={handleSearch}
        onClearAll={handleClearAll}
        onExportCSV={handleExportCSV}
        isLoading={shiftsLoading}
      />

      <ShiftsTable
        shifts={shifts}
        isLoading={shiftsLoading}
        onViewDetails={handleViewDetails}
      />

      <ShiftsPagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={25}
        onPageChange={setCurrentPage}
      />

      <ShiftDetailModal
        shift={selectedShift}
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
      />
    </div>
  );
}