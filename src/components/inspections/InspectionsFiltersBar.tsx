import * as React from "react";
import { GlobalSearchInput } from "@/components/filters/GlobalSearchInput";
import { DateRangePicker } from "@/components/filters/DateRangePicker";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface InspectionsFiltersBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
  regions: string[];
  selectedRegion: string;
  onRegionChange: (region: string) => void;
  dateFrom?: string;
  dateTo?: string;
  onDateChange: (dateFrom?: string, dateTo?: string) => void;
  onClearAll: () => void;
  resultCount: number;
  isLoading?: boolean;
}

export function InspectionsFiltersBar({
  searchQuery,
  onSearchChange,
  onSearchClear,
  regions,
  selectedRegion,
  onRegionChange,
  dateFrom,
  dateTo,
  onDateChange,
  onClearAll,
  resultCount,
  isLoading = false,
}: InspectionsFiltersBarProps) {
  const hasActiveFilters =
    searchQuery.length >= 2 || selectedRegion !== "all" || dateFrom || dateTo;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <GlobalSearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Søg kunde, reg.nr., adresse..."
          className="w-full sm:w-80"
        />

        <DateRangePicker
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateChange={onDateChange}
        />

        <Select value={selectedRegion} onValueChange={onRegionChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Vælg landsdel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle landsdele</SelectItem>
            {regions.map((region) => (
              <SelectItem key={region} value={region}>
                {region}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            onClick={onClearAll}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
            Ryd filtre
          </Button>
        )}
      </div>

      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Aktive filtre:</span>
          {selectedRegion !== "all" && (
            <Badge variant="secondary" className="gap-1">
              {selectedRegion}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onRegionChange("all")}
              />
            </Badge>
          )}
          {(dateFrom || dateTo) && (
            <Badge variant="secondary" className="gap-1">
              {dateFrom && dateTo
                ? `${dateFrom} - ${dateTo}`
                : dateFrom
                ? `Fra ${dateFrom}`
                : `Til ${dateTo}`}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onDateChange(undefined, undefined)}
              />
            </Badge>
          )}
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        {isLoading ? "Indlæser..." : `${resultCount} syn ${hasActiveFilters ? "matcher filtre" : "i alt"}`}
      </div>
    </div>
  );
}
