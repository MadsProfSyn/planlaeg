import * as React from "react";
import { GlobalSearchInput } from "@/components/filters/GlobalSearchInput";
import { DepartmentMultiSelect } from "@/components/filters/DepartmentMultiSelect";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface ScheduledFiltersBarProps {
  globalSearch: string;
  onGlobalSearchChange: (value: string) => void;
  departments: string[];
  selectedDepartments: string[];
  onDepartmentsChange: (departments: string[]) => void;
  status: string;
  onStatusChange: (status: string) => void;
  types: string[];
  selectedTypes: string[];
  onTypesChange: (types: string[]) => void;
  dateFrom?: string;
  dateTo?: string;
  onDateChange: (dateFrom?: string, dateTo?: string) => void;
  onClearAll: () => void;
  resultCount: number;
}

const availableTypes = ["Proforma", "Projektsyn", "Indflytningssyn", "Fraflytningssyn"];
const statuses = [
  { value: "all", label: "Alle" },
  { value: "PROPOSED", label: "Foreslået" },
  { value: "APPROVED", label: "Godkendt" },
  { value: "SCHEDULED", label: "Planlagt" },
];

export function ScheduledFiltersBar({
  globalSearch,
  onGlobalSearchChange,
  departments,
  selectedDepartments,
  onDepartmentsChange,
  status,
  onStatusChange,
  types,
  selectedTypes,
  onTypesChange,
  dateFrom,
  dateTo,
  onDateChange,
  onClearAll,
  resultCount,
}: ScheduledFiltersBarProps) {
  const [typesOpen, setTypesOpen] = React.useState(false);

  const hasActiveFilters =
    globalSearch ||
    selectedDepartments.length > 0 ||
    status !== "all" ||
    selectedTypes.length > 0 ||
    dateFrom ||
    dateTo;

  const handleTypeSelect = (type: string) => {
    const newTypes = selectedTypes.includes(type)
      ? selectedTypes.filter((t) => t !== type)
      : [...selectedTypes, type];
    onTypesChange(newTypes);
  };

  const handleSelectAllTypes = () => {
    if (selectedTypes.length === availableTypes.length) {
      onTypesChange([]);
    } else {
      onTypesChange(availableTypes);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <GlobalSearchInput
          value={globalSearch}
          onChange={onGlobalSearchChange}
          placeholder="Søg synskonsulent, adresse..."
          className="w-full sm:w-80"
        />

        <DepartmentMultiSelect
          departments={departments}
          selectedDepartments={selectedDepartments}
          onSelectionChange={onDepartmentsChange}
        />

        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover open={typesOpen} onOpenChange={setTypesOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-between min-w-[180px]">
              <span>
                {selectedTypes.length === 0
                  ? "Synstype"
                  : selectedTypes.length === availableTypes.length
                  ? "Alle typer"
                  : `${selectedTypes.length} valgt`}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Søg synstype..." />
              <CommandEmpty>Ingen typer fundet.</CommandEmpty>
              <CommandGroup className="max-h-64 overflow-auto">
                <CommandItem onSelect={handleSelectAllTypes} className="cursor-pointer">
                  <Checkbox
                    checked={selectedTypes.length === availableTypes.length}
                    className="mr-2"
                  />
                  <span className="font-medium">Vælg alle</span>
                </CommandItem>
                {availableTypes.map((type) => (
                  <CommandItem
                    key={type}
                    onSelect={() => handleTypeSelect(type)}
                    className="cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedTypes.includes(type)}
                      className="mr-2"
                    />
                    <span>{type}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>

        <DateRangePicker
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateChange={onDateChange}
        />

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
          {selectedDepartments.map((dept) => (
            <Badge key={dept} variant="secondary" className="gap-1">
              {dept}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() =>
                  onDepartmentsChange(selectedDepartments.filter((d) => d !== dept))
                }
              />
            </Badge>
          ))}
          {status !== "all" && (
            <Badge variant="secondary" className="gap-1">
              {statuses.find((s) => s.value === status)?.label}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onStatusChange("all")}
              />
            </Badge>
          )}
          {selectedTypes.map((type) => (
            <Badge key={type} variant="secondary" className="gap-1">
              {type}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onTypesChange(selectedTypes.filter((t) => t !== type))}
              />
            </Badge>
          ))}
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
        {resultCount} syn {hasActiveFilters ? "matcher filtre" : "i alt"}
      </div>
    </div>
  );
}
