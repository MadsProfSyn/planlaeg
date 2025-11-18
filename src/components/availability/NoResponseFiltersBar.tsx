import { Button } from "@/components/ui/button";
import { SingleDatePicker } from "@/components/filters/SingleDatePicker";
import { Search, RotateCcw } from "lucide-react";

interface NoResponseFiltersBarProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  onSearch: () => void;
  onReset: () => void;
  isLoading?: boolean;
}

export function NoResponseFiltersBar({
  selectedDate,
  onDateChange,
  onSearch,
  onReset,
  isLoading = false,
}: NoResponseFiltersBarProps) {
  return (
    <div className="bg-card p-6 rounded-lg border border-border mb-6 shadow-sm">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium text-foreground mb-2 block">
            Vælg dato
          </label>
          <SingleDatePicker
            date={selectedDate}
            onDateChange={onDateChange}
            disabled={isLoading}
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={onSearch}
            disabled={isLoading}
            className="gap-2"
          >
            <Search className="h-4 w-4" />
            Søg
          </Button>
          <Button
            variant="outline"
            onClick={onReset}
            disabled={isLoading}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Nulstil
          </Button>
        </div>
      </div>
    </div>
  );
}
