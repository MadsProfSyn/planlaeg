import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DepartmentSingleSelect } from "./DepartmentSingleSelect";
import { DateRangePicker } from "./DateRangePicker";
import { SynsTypeMultiSelect } from "./SynsTypeMultiSelect";
import { GlobalSearchInput } from "./GlobalSearchInput";
import { ShiftFilters } from "@/lib/shifts";
import { Download, Search, RotateCcw } from "lucide-react";

interface ShiftsFiltersBarProps {
  departments: string[];
  synsTypes: { code: string; label: string }[];
  filters: ShiftFilters;
  onFiltersChange: (filters: ShiftFilters) => void;
  onSearch: () => void;
  onClearAll: () => void;
  onExportCSV: () => void;
  isLoading?: boolean;
}

export function ShiftsFiltersBar({
  departments,
  synsTypes,
  filters,
  onFiltersChange,
  onSearch,
  onClearAll,
  onExportCSV,
  isLoading = false,
}: ShiftsFiltersBarProps) {
  const handleDepartmentChange = (department: string) => {
    onFiltersChange({ ...filters, department: department || undefined });
  };

  const handleDateChange = (dateFrom?: string, dateTo?: string) => {
    onFiltersChange({ ...filters, dateFrom, dateTo });
  };

  const handleSynsTypesChange = (synsTypes: string[]) => {
    onFiltersChange({ 
      ...filters, 
      synsTypes: synsTypes.length > 0 ? synsTypes : undefined 
    });
  };

  const handleGlobalSearchChange = (globalSearch: string) => {
    onFiltersChange({ 
      ...filters, 
      globalSearch: globalSearch.trim() || undefined 
    });
  };

  const hasActiveFilters = Boolean(
    filters.department ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.synsTypes?.length ||
    filters.globalSearch
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Filtre</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Afdeling</label>
            <DepartmentSingleSelect
              departments={departments}
              selectedDepartment={filters.department || ""}
              onSelectionChange={handleDepartmentChange}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Dato</label>
            <DateRangePicker
              dateFrom={filters.dateFrom}
              dateTo={filters.dateTo}
              onDateChange={handleDateChange}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Synstype</label>
            <SynsTypeMultiSelect
              synsTypes={synsTypes}
              selectedTypes={filters.synsTypes || []}
              onSelectionChange={handleSynsTypesChange}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Fri søgning</label>
            <GlobalSearchInput
              value={filters.globalSearch || ""}
              onChange={handleGlobalSearchChange}
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={onSearch}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Search className="h-4 w-4" />
            Søg
          </Button>

          <Button
            variant="outline"
            onClick={onClearAll}
            disabled={isLoading || !hasActiveFilters}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Nulstil
          </Button>

          <Button
            variant="outline"
            onClick={onExportCSV}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Eksporter CSV
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}