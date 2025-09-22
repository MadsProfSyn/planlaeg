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

interface SynsTypeMultiSelectProps {
  synsTypes: { code: string; label: string }[];
  selectedTypes: string[];
  onSelectionChange: (types: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function SynsTypeMultiSelect({
  synsTypes,
  selectedTypes,
  onSelectionChange,
  disabled = false,
  placeholder = "Vælg synstyper",
}: SynsTypeMultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const allTypeCodes = synsTypes.map(t => t.code);
  const isAllSelected = selectedTypes.length === synsTypes.length && 
    allTypeCodes.every(code => selectedTypes.includes(code));

  const handleSelect = (typeCode: string) => {
    if (typeCode === "ALLE") {
      // Handle "Alle" selection
      if (isAllSelected) {
        onSelectionChange([]);
      } else {
        onSelectionChange(allTypeCodes);
      }
      return;
    }

    const isSelected = selectedTypes.includes(typeCode);
    let newSelection;
    
    if (isSelected) {
      newSelection = selectedTypes.filter((t) => t !== typeCode);
    } else {
      newSelection = [...selectedTypes, typeCode];
    }
    
    onSelectionChange(newSelection);
  };

  const handleSelectAll = () => {
    if (isAllSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(allTypeCodes);
    }
  };

  const handleClear = () => {
    onSelectionChange([]);
  };

  const removeSelection = (typeCode: string) => {
    onSelectionChange(selectedTypes.filter((t) => t !== typeCode));
  };

  const getSelectedLabels = () => {
    return selectedTypes.map(code => 
      synsTypes.find(t => t.code === code)?.label || code
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
              {selectedTypes.length === 0
                ? placeholder
                : isAllSelected
                ? "Alle synstyper"
                : `${selectedTypes.length} synstype${
                    selectedTypes.length === 1 ? "" : "r"
                  } valgt`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Søg synstyper..." />
            <CommandList>
              <CommandEmpty>Ingen synstyper fundet.</CommandEmpty>
              <CommandGroup>
                <CommandItem onSelect={() => handleSelect("ALLE")}>
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      isAllSelected ? "opacity-100" : "opacity-0"
                    )}
                  />
                  Alle ({synsTypes.length})
                </CommandItem>
                {synsTypes.map((synsType) => (
                  <CommandItem
                    key={synsType.code}
                    value={synsType.label}
                    onSelect={() => handleSelect(synsType.code)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedTypes.includes(synsType.code)
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {synsType.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedTypes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {getSelectedLabels().map((label, index) => (
            <Badge
              key={selectedTypes[index]}
              variant="secondary"
              className="text-xs"
            >
              {label}
              <button
                className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    removeSelection(selectedTypes[index]);
                  }
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={() => removeSelection(selectedTypes[index])}
                aria-label={`Remove ${label}`}
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
            Ryd alle
          </Button>
        </div>
      )}
    </div>
  );
}