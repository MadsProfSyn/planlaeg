import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

interface DepartmentMultiSelectProps {
  departments: string[];
  selectedDepartments: string[];
  onSelectionChange: (departments: string[]) => void;
  disabled?: boolean;
}

export function DepartmentMultiSelect({
  departments,
  selectedDepartments,
  onSelectionChange,
  disabled = false,
}: DepartmentMultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (department: string) => {
    const isSelected = selectedDepartments.includes(department);
    if (isSelected) {
      onSelectionChange(
        selectedDepartments.filter((d) => d !== department)
      );
    } else {
      onSelectionChange([...selectedDepartments, department]);
    }
  };

  const handleSelectAll = () => {
    if (selectedDepartments.length === departments.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(departments);
    }
  };

  const handleClear = () => {
    onSelectionChange([]);
  };

  const removeSelection = (department: string) => {
    onSelectionChange(
      selectedDepartments.filter((d) => d !== department)
    );
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            <span className="truncate">
              {selectedDepartments.length === 0
                ? "Select departments..."
                : `${selectedDepartments.length} department${
                    selectedDepartments.length === 1 ? "" : "s"
                  } selected`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search departments..." />
            <CommandList>
              <CommandEmpty>No departments found.</CommandEmpty>
              <CommandGroup>
                <CommandItem onSelect={handleSelectAll}>
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedDepartments.length === departments.length
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  Select All ({departments.length})
                </CommandItem>
                {departments.map((department) => (
                  <CommandItem
                    key={department}
                    value={department}
                    onSelect={() => handleSelect(department)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedDepartments.includes(department)
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {department}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedDepartments.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedDepartments.map((department) => (
            <Badge
              key={department}
              variant="secondary"
              className="text-xs"
            >
              {department}
              <button
                className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    removeSelection(department);
                  }
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={() => removeSelection(department)}
              >
                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-6 px-2 text-xs"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}