import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { FiltersBar } from "@/components/filters/FiltersBar";
import { InspectionsTable } from "@/components/inspections/InspectionsTable";
import { InspectionsPagination } from "@/components/inspections/InspectionsPagination";
import { getInspections, getDepartments, InspectionFilters } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";

// Custom hook for debounced value
function useDebounced<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function InspectionsPage() {
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const [filters, setFilters] = React.useState<InspectionFilters>({});
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  // Debounce filters to avoid excessive API calls
  const debouncedFilters = useDebounced(filters, 300);

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedFilters]);

  // Reset to first page when page size changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  // Fetch departments for filter
  const {
    data: departments = [],
    isLoading: isDepartmentsLoading,
    error: departmentsError,
  } = useQuery({
    queryKey: ["departments"],
    queryFn: getDepartments,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch inspections
  const {
    data: inspectionsData,
    isLoading: isInspectionsLoading,
    error: inspectionsError,
  } = useQuery({
    queryKey: ["inspections", currentPage, pageSize, debouncedFilters],
    queryFn: () => getInspections(currentPage, pageSize, debouncedFilters),
    staleTime: 30 * 1000, // 30 seconds
  });

  // Handle errors
  React.useEffect(() => {
    if (departmentsError) {
      toast({
        title: "Error loading departments",
        description: "Failed to load department list. Please try again.",
        variant: "destructive",
      });
    }
  }, [departmentsError, toast]);

  React.useEffect(() => {
    if (inspectionsError) {
      toast({
        title: "Error loading inspections",
        description: "Failed to load inspections. Please try refresh the page.",
        variant: "destructive",
      });
    }
  }, [inspectionsError, toast]);

  const handleFiltersChange = (newFilters: InspectionFilters) => {
    setFilters(newFilters);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
  };

  const handleSelectionChange = (ids: string[]) => {
    setSelectedIds(ids);
  };

  const isLoading = isInspectionsLoading || isDepartmentsLoading;
  const inspections = inspectionsData?.data || [];
  const totalCount = inspectionsData?.count || 0;
  const totalPages = inspectionsData?.totalPages || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Inspections to be Scheduled
          </h1>
          <p className="text-muted-foreground">
            Select and manage unscheduled property inspections
          </p>
        </div>
      </div>

      <FiltersBar
        departments={departments}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        isLoading={isLoading}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Unscheduled Inspections</span>
            <span className="text-sm font-normal text-muted-foreground">
              {totalCount} total
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InspectionsTable
            inspections={inspections}
            selectedIds={selectedIds}
            onSelectionChange={handleSelectionChange}
            isLoading={isLoading}
            totalCount={totalCount}
          />
        </CardContent>
      </Card>

      <InspectionsPagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        isLoading={isLoading}
      />
    </div>
  );
}