import * as React from "react";
import { SingleDatePicker } from "@/components/filters/SingleDatePicker";
import { Button } from "@/components/ui/button";
import { Search, RotateCcw } from "lucide-react";

interface SmsHistoryFiltersBarProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  onSearch: () => void;
  onReset: () => void;
  isLoading: boolean;
}

export function SmsHistoryFiltersBar({
  selectedDate,
  onDateChange,
  onSearch,
  onReset,
  isLoading,
}: SmsHistoryFiltersBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-card rounded-lg border">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Anmodet dato:</span>
        <SingleDatePicker date={selectedDate} onDateChange={(d) => onDateChange(d || selectedDate)} />
      </div>

      <div className="flex gap-2 ml-auto">
        <Button variant="outline" size="sm" onClick={onReset} disabled={isLoading}>
          <RotateCcw className="h-4 w-4 mr-1" />
          Nulstil
        </Button>
        <Button size="sm" onClick={onSearch} disabled={isLoading}>
          <Search className="h-4 w-4 mr-1" />
          Søg
        </Button>
      </div>
    </div>
  );
}
