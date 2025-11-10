import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarCheck, Table as TableIcon, Map } from "lucide-react";
import { ScheduledTable, type SortColumn, type SortDirection } from "@/components/scheduled/ScheduledTable";
import { ScheduledFiltersBar } from "@/components/scheduled/ScheduledFiltersBar";
import { InspectorRoutesView } from "@/components/scheduled/InspectorRoutesView";
import { getProposedAssignments, type ScheduledFilters, type ProposedAssignment } from "@/lib/scheduled";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ScheduledPage() {
  const { toast } = useToast();

  // Filter states
  const [globalSearch, setGlobalSearch] = React.useState("");
  const [selectedDepartments, setSelectedDepartments] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState("all");
  const [selectedTypes, setSelectedTypes] = React.useState<string[]>([]);
  const [date, setDate] = React.useState<string | undefined>();

  // Sort states
  const [sortColumn, setSortColumn] = React.useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("asc");

  // View state
  const [view, setView] = React.useState<"table" | "routes">(
    () => (localStorage.getItem("scheduledView") as "table" | "routes") || "table"
  );

  React.useEffect(() => {
    localStorage.setItem("scheduledView", view);
  }, [view]);

  // Build filters object for backend
  const backendFilters: ScheduledFilters = React.useMemo(() => {
    const filters: ScheduledFilters = {};
    if (selectedDepartments.length > 0) filters.departments = selectedDepartments;
    if (date) {
      filters.dateFrom = date;
      filters.dateTo = date;
    }
    if (status !== "all") filters.status = status;
    return filters;
  }, [selectedDepartments, date, status]);

  // Fetch proposed assignments
  const {
    data: assignments = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["proposed-assignments", backendFilters],
    queryFn: () => getProposedAssignments(backendFilters),
    staleTime: 30 * 1000, // 30 seconds
  });

  // Get unique departments for filter
  const allDepartments = React.useMemo(() => {
    const depts = new Set(assignments.map((a) => a.inspection_department).filter(Boolean));
    return Array.from(depts).sort();
  }, [assignments]);

  // Apply client-side filters
  const filteredAssignments = React.useMemo(() => {
    let filtered = [...assignments];

    // Global search filter
    if (globalSearch) {
      const search = globalSearch.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.inspector_name?.toLowerCase().includes(search) ||
          a.inspection_address?.toLowerCase().includes(search)
      );
    }

    // Type filter
    if (selectedTypes.length > 0) {
      filtered = filtered.filter((a) =>
        selectedTypes.includes(a.inspection_type || "")
      );
    }

    return filtered;
  }, [assignments, globalSearch, selectedTypes]);

  // Apply sorting
  const sortedAssignments = React.useMemo(() => {
    if (!sortColumn) return filteredAssignments;

    return [...filteredAssignments].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredAssignments, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleDateChange = (newDate?: string) => {
    setDate(newDate);
  };

  const handleClearAll = () => {
    setGlobalSearch("");
    setSelectedDepartments([]);
    setStatus("all");
    setSelectedTypes([]);
    setDate(undefined);
    setSortColumn(null);
    setSortDirection("asc");
  };

  // Handle errors
  React.useEffect(() => {
    if (error) {
      toast({
        title: "Fejl ved indlæsning",
        description: "Kunne ikke hente planlagte syn. Prøv at genindlæse siden.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <CalendarCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="page-title">Planlagte Syn</h1>
          <p className="text-caption mt-1">Godkendte og planlagte syn</p>
        </div>
      </div>

      <Card className="rounded-2xl shadow-sm mb-6">
        <CardContent className="p-6 bg-muted/20">
          <ScheduledFiltersBar
            globalSearch={globalSearch}
            onGlobalSearchChange={setGlobalSearch}
            departments={allDepartments}
            selectedDepartments={selectedDepartments}
            onDepartmentsChange={setSelectedDepartments}
            status={status}
            onStatusChange={setStatus}
            types={["Proforma", "Projektsyn", "Indflytningssyn", "Fraflytningssyn"]}
            selectedTypes={selectedTypes}
            onTypesChange={setSelectedTypes}
            date={date}
            onDateChange={handleDateChange}
            onClearAll={handleClearAll}
            resultCount={sortedAssignments.length}
          />
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center justify-between text-lg">
            <span>Planlagte syn</span>
            <div className="flex items-center gap-4">
              <span className="text-sm font-normal text-muted-foreground">
                {sortedAssignments.length} planlagte
              </span>
              <Tabs value={view} onValueChange={(v) => setView(v as "table" | "routes")}>
                <TabsList className="h-9">
                  <TabsTrigger value="table" className="text-xs">
                    <TableIcon className="h-4 w-4 mr-1" />
                    Tabel
                  </TabsTrigger>
                  <TabsTrigger value="routes" className="text-xs">
                    <Map className="h-4 w-4 mr-1" />
                    Ruter
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardTitle>
        </CardHeader>
        {view === "table" ? (
          <CardContent className="p-6">
            <ScheduledTable
              assignments={sortedAssignments}
              isLoading={isLoading}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
          </CardContent>
        ) : (
          <InspectorRoutesView assignments={sortedAssignments} />
        )}
      </Card>
    </div>
  );
}