import * as React from "react";
import { Button } from "@/components/ui/button";
import { DepartmentMultiSelect } from "@/components/filters/DepartmentMultiSelect";
import { DateRangePicker } from "@/components/filters/DateRangePicker";
import { SynsTypeMultiSelect } from "@/components/filters/SynsTypeMultiSelect";
import { GlobalSearchInput } from "@/components/filters/GlobalSearchInput";
import { Card } from "@/components/ui/card";
import { Search, RotateCcw, RefreshCw } from "lucide-react";

interface AvailabilityFilters {
  afdeling: string[];
  from: string;
  to: string;
  synstyper: string[];
  synstyper_all: boolean;
  q: string;
}

interface AvailabilityFiltersBarProps {
  filters: AvailabilityFilters;
  onFiltersChange: (filters: AvailabilityFilters) => void;
  departments: { value: string; label: string }[];
  onSearch: () => void;
  onReset: () => void;
  onSync: () => void;
  isLoading?: boolean;
}

const INSPECTION_TYPES = [
  { code: "Proforma", label: "Proforma" },
  { code: "Projektsyn", label: "Projektsyn" },
  { code: "Indflytningssyn", label: "Indflytningssyn" },
  { code: "Fraflytningssyn", label: "Fraflytningssyn" },
];

export function AvailabilityFiltersBar({
  filters,
  onFiltersChange,
  departments,
  onSearch,
  onReset,
  onSync,
  isLoading = false,
}: AvailabilityFiltersBarProps) {
  const updateFilter = (key: keyof AvailabilityFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    
    // Handle synstyper logic
    if (key === "synstyper") {
      const allTypes = INSPECTION_TYPES.map(t => t.code);
      const isAllSelected = value.length === allTypes.length && 
        allTypes.every((type: string) => value.includes(type));
      newFilters.synstyper_all = isAllSelected;
    }
    
    onFiltersChange(newFilters);
  };

  const handleDateRangeChange = (dateFrom?: string, dateTo?: string) => {
    const newFilters = { ...filters };
    if (dateFrom) {
      newFilters.from = dateFrom;
    }
    if (dateTo) {
      newFilters.to = dateTo;
    }
    onFiltersChange(newFilters);
  };

  return (
    <Card className="p-6 mb-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Afdeling
          </label>
          <DepartmentMultiSelect
            departments={departments.map(d => d.value)}
            selectedDepartments={filters.afdeling}
            onSelectionChange={(depts) => updateFilter("afdeling", depts)}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Dato interval
          </label>
          <DateRangePicker
            dateFrom={filters.from}
            dateTo={filters.to}
            onDateChange={handleDateRangeChange}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Synstyper
          </label>
          <SynsTypeMultiSelect
            synsTypes={INSPECTION_TYPES}
            selectedTypes={filters.synstyper}
            onSelectionChange={(types) => updateFilter("synstyper", types)}
            placeholder="Vælg synstyper"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Fri søgning
          </label>
          <GlobalSearchInput
            value={filters.q}
            onChange={(value) => updateFilter("q", value)}
            placeholder="Søg navn, adresse, afdeling..."
          />
        </div>

        <div className="flex items-end gap-2">
          <Button
            onClick={onSync}
            disabled={isLoading}
            variant="secondary"
            size="default"
            title="Synkroniser tilgængelighed fra WorkFeed"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            onClick={onSearch}
            disabled={isLoading}
            className="flex-1"
            size="default"
          >
            <Search className="h-4 w-4 mr-2" />
            Søg
          </Button>
          <Button
            onClick={onReset}
            variant="outline"
            size="default"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}