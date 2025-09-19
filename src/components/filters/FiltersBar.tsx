import * as React from "react";
import { Filter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DepartmentMultiSelect } from "./DepartmentMultiSelect";
import { DateRangePicker } from "./DateRangePicker";
import { InspectionFilters } from "@/lib/supabase";

interface FiltersBarProps {
  departments: string[];
  filters: InspectionFilters;
  onFiltersChange: (filters: InspectionFilters) => void;
  isLoading?: boolean;
}

export function FiltersBar({
  departments,
  filters,
  onFiltersChange,
  isLoading = false,
}: FiltersBarProps) {
  const handleDepartmentChange = (selectedDepartments: string[]) => {
    onFiltersChange({
      ...filters,
      departments: selectedDepartments.length > 0 ? selectedDepartments : undefined,
    });
  };

  const handleDateChange = (dateFrom?: string, dateTo?: string) => {
    onFiltersChange({
      ...filters,
      dateFrom,
      dateTo,
    });
  };

  const handleClearAll = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = 
    (filters.departments && filters.departments.length > 0) ||
    filters.dateFrom ||
    filters.dateTo;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              disabled={isLoading}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Departments
            </label>
            <DepartmentMultiSelect
              departments={departments}
              selectedDepartments={filters.departments || []}
              onSelectionChange={handleDepartmentChange}
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">
              Date Range
            </label>
            <DateRangePicker
              dateFrom={filters.dateFrom}
              dateTo={filters.dateTo}
              onDateChange={handleDateChange}
              disabled={isLoading}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}