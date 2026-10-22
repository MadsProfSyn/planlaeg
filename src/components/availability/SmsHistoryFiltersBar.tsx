import * as React from "react";
import { SingleDatePicker } from "@/components/filters/SingleDatePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RotateCcw, Search } from "lucide-react";

export interface SmsHistoryFilters {
  sentFrom: string;
  sentTo: string;
  targetDate?: string;
  search: string;
}

interface SmsHistoryFiltersBarProps {
  filters: SmsHistoryFilters;
  onChange: (filters: SmsHistoryFilters) => void;
  onReset: () => void;
  isLoading: boolean;
}

export function SmsHistoryFiltersBar({ filters, onChange, onReset, isLoading }: SmsHistoryFiltersBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-card rounded-lg border">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Sendt fra:</span>
        <SingleDatePicker
          date={filters.sentFrom}
          onDateChange={(d) => onChange({ ...filters, sentFrom: d || filters.sentFrom })}
          disabled={!!filters.targetDate}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Sendt til:</span>
        <SingleDatePicker
          date={filters.sentTo}
          onDateChange={(d) => onChange({ ...filters, sentTo: d || filters.sentTo })}
          disabled={!!filters.targetDate}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Gælder dato:</span>
        <SingleDatePicker
          date={filters.targetDate}
          onDateChange={(d) => onChange({ ...filters, targetDate: d })}
          placeholder="Alle datoer"
        />
      </div>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Søg navn..."
          className="pl-8 w-48"
        />
      </div>
      <div className="ml-auto">
        <Button variant="outline" size="sm" onClick={onReset} disabled={isLoading}>
          <RotateCcw className="h-4 w-4 mr-1" />
          Nulstil
        </Button>
      </div>
    </div>
  );
}
