import * as React from "react";
import { Calendar, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDateForDisplay, getCurrentDateForInput } from "@/lib/date-utils";

interface DateRangePickerProps {
  dateFrom?: string;
  dateTo?: string;
  onDateChange: (dateFrom?: string, dateTo?: string) => void;
  disabled?: boolean;
}

export function DateRangePicker({
  dateFrom,
  dateTo,
  onDateChange,
  disabled = false,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [tempDateFrom, setTempDateFrom] = React.useState(dateFrom || "");
  const [tempDateTo, setTempDateTo] = React.useState(dateTo || "");

  React.useEffect(() => {
    setTempDateFrom(dateFrom || "");
    setTempDateTo(dateTo || "");
  }, [dateFrom, dateTo]);

  const handleApply = () => {
    onDateChange(
      tempDateFrom || undefined,
      tempDateTo || undefined
    );
    setOpen(false);
  };

  const handleClear = () => {
    setTempDateFrom("");
    setTempDateTo("");
    onDateChange(undefined, undefined);
    setOpen(false);
  };

  const handleQuickSelect = (preset: "today" | "week" | "month") => {
    const today = getCurrentDateForInput();
    const date = new Date();
    
    switch (preset) {
      case "today":
        setTempDateFrom(today);
        setTempDateTo(today);
        break;
      case "week":
        setTempDateFrom(today);
        date.setDate(date.getDate() + 7);
        setTempDateTo(date.toISOString().split("T")[0]);
        break;
      case "month":
        setTempDateFrom(today);
        date.setMonth(date.getMonth() + 1);
        setTempDateTo(date.toISOString().split("T")[0]);
        break;
    }
  };

  const getDisplayText = () => {
    if (!dateFrom && !dateTo) return "Select date range...";
    if (dateFrom && !dateTo) return `From ${formatDateForDisplay(dateFrom)}`;
    if (!dateFrom && dateTo) return `Until ${formatDateForDisplay(dateTo)}`;
    if (dateFrom === dateTo) return formatDateForDisplay(dateFrom);
    return `${formatDateForDisplay(dateFrom)} - ${formatDateForDisplay(dateTo)}`;
  };

  const hasDateFilter = dateFrom || dateTo;

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !hasDateFilter && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <Calendar className="mr-2 h-4 w-4" />
            {getDisplayText()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="start">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect("today")}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect("week")}
              >
                Next 7 days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect("month")}
              >
                Next 30 days
              </Button>
            </div>

            <div className="grid gap-2">
              <div>
                <Label htmlFor="date-from">From</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={tempDateFrom}
                  onChange={(e) => setTempDateFrom(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="date-to">To</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={tempDateTo}
                  onChange={(e) => setTempDateTo(e.target.value)}
                  min={tempDateFrom || undefined}
                />
              </div>
            </div>

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={handleClear}>
                Clear
              </Button>
              <Button onClick={handleApply}>Apply</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {hasDateFilter && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="h-6 px-2 text-xs"
        >
          <X className="mr-1 h-3 w-3" />
          Clear date filter
        </Button>
      )}
    </div>
  );
}