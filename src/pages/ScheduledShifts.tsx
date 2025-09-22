import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShiftsFiltersBar } from "@/components/filters/ShiftsFiltersBar";
import { ShiftsTable } from "@/components/shifts/ShiftsTable";
import { ShiftsPagination } from "@/components/shifts/ShiftsPagination";
import { ShiftDetailModal } from "@/components/shifts/ShiftDetailModal";
import { getShiftDepartments, getCanonicalRoles, Shift, ShiftFilters } from "@/lib/shifts";
import { getCurrentDateForInput } from "@/lib/date-utils";
import { fetchShifts, WorkfeedShift, DateRanges } from "@/lib/workfeed";
import { useToast } from "@/components/ui/use-toast";

export default function ScheduledShiftsPage() {
  const [currentPage, setCurrentPage] = React.useState(1);
  const [filters, setFilters] = React.useState<ShiftFilters>({
    dateFrom: getCurrentDateForInput(),
    dateTo: getCurrentDateForInput(),
  });
  const [selectedShift, setSelectedShift] = React.useState<Shift | null>(null);
  const [showDetailModal, setShowDetailModal] = React.useState(false);
  const { toast } = useToast();

  // Fetch shifts from database
  const {
    data: shiftsResponse,
    isLoading: shiftsLoading,
    error: shiftsError,
    refetch: refetchShifts,
  } = useQuery({
    queryKey: ["shifts", filters],
    queryFn: async () => {
      const result = await fetchShifts({
        startDate: filters.dateFrom,
        endDate: filters.dateTo,
        department: filters.department,
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch shifts');
      }
      
      return result.shifts;
    },
    retry: 1,
  });

  // Fetch departments for filter
  const { data: departments = [] } = useQuery({
    queryKey: ["shift-departments"],
    queryFn: getShiftDepartments,
    retry: 1,
  });

  const synsTypes = getCanonicalRoles();

  // Transform Workfeed shifts to match your existing Shift interface
  const transformWorkfeedShift = (workfeedShift: WorkfeedShift): Shift => {
    return {
      id: workfeedShift.id,
      wf_shift_id: workfeedShift.id, // Use the database id as shift id
      wf_role_id: workfeedShift.type,
      start_utc: workfeedShift.start_utc,
      end_utc: workfeedShift.end_utc,
      date_local: workfeedShift.date_local,
      inspector_name: workfeedShift.inspector_name,
      department: workfeedShift.department,
      type: workfeedShift.type,
      status: workfeedShift.status,
      created_at: workfeedShift.created_at || new Date().toISOString(),
      inspector_id: workfeedShift.inspector_id,
    };
  };

  // Process the data for pagination and client-side filtering
  let allShifts = shiftsResponse?.map(transformWorkfeedShift) || [];
  
  // Apply client-side filters that aren't handled by the API
  if (filters.synsTypes && filters.synsTypes.length > 0) {
    allShifts = allShifts.filter(shift => 
      filters.synsTypes!.some(synsType => 
        shift.type?.includes(synsType) || 
        shift.wf_role_id?.includes(synsType.toLowerCase())
      )
    );
  }

  if (filters.globalSearch && filters.globalSearch.trim()) {
    const search = filters.globalSearch.toLowerCase().trim();
    allShifts = allShifts.filter(shift => 
      shift.inspector_name?.toLowerCase().includes(search) ||
      shift.department?.toLowerCase().includes(search) ||
      shift.type?.toLowerCase().includes(search)
    );
  }
  
  // Client-side pagination (since we're getting all data from API)
  const pageSize = 25;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const shifts = allShifts.slice(startIndex, endIndex);
  const totalCount = allShifts.length;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handleSearch = () => {
    setCurrentPage(1);
    // The query will automatically refetch when filters change
  };

  const handleClearAll = () => {
    setFilters({
      dateFrom: getCurrentDateForInput(),
      dateTo: getCurrentDateForInput(),
    });
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    const csvContent = [
      "Navn,Afdeling,Synstyper,Dato,Tidspunkt,Status",
      ...allShifts.map(shift => [
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

  const handleRefreshShifts = async () => {
    try {
      await refetchShifts();
      toast({
        title: "Data Refreshed",
        description: "Shifts have been refreshed from database",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh shifts data",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Planlagte vagter</h1>
        <Button 
          onClick={handleRefreshShifts}
          disabled={shiftsLoading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${shiftsLoading ? 'animate-spin' : ''}`} />
          {shiftsLoading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {shiftsError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            Kunne ikke hente vagter fra database. Fejl: {shiftsError.message}
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
        pageSize={pageSize}
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