import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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

interface DepartmentSingleSelectProps {
  departments: string[];
  selectedDepartment: string;
  onSelectionChange: (department: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function DepartmentSingleSelect({
  departments,
  selectedDepartment,
  onSelectionChange,
  disabled = false,
  placeholder = "Vælg afdeling",
}: DepartmentSingleSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (department: string) => {
    onSelectionChange(department === selectedDepartment ? "" : department);
    setOpen(false);
  };

  return (
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
            {selectedDepartment || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Søg afdeling..." />
          <CommandList>
            <CommandEmpty>Ingen afdelinger fundet.</CommandEmpty>
            <CommandGroup>
              <CommandItem onSelect={() => handleSelect("")}>
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    !selectedDepartment ? "opacity-100" : "opacity-0"
                  )}
                />
                Alle afdelinger
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
                      selectedDepartment === department
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
  );
}