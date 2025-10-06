import * as React from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
  isLoading?: boolean;
  resultCount?: number;
  className?: string;
  debounceMs?: number;
  minChars?: number;
}

export function SearchBar({
  value,
  onChange,
  onClear,
  placeholder = "Søg (kunde, reg.nr., adresse)",
  isLoading = false,
  resultCount,
  className,
  debounceMs = 250,
  minChars = 2,
}: SearchBarProps) {
  const [localValue, setLocalValue] = React.useState(value);
  const timeoutRef = React.useRef<NodeJS.Timeout>();
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  React.useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [localValue, onChange, value, debounceMs]);

  const handleClear = () => {
    setLocalValue("");
    onClear();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      handleClear();
    }
  };

  const showMinCharsHint = localValue.length > 0 && localValue.length < minChars;
  const isSearchActive = localValue.length >= minChars;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-9 pr-20"
          aria-label="Søg i syn"
          aria-describedby={showMinCharsHint ? "search-hint" : undefined}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {localValue && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-7 w-7 p-0"
              aria-label="Ryd søgning"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      {showMinCharsHint && (
        <p id="search-hint" className="text-sm text-muted-foreground">
          Indtast mindst {minChars} tegn for at søge
        </p>
      )}
      
      {isSearchActive && resultCount !== undefined && !isLoading && (
        <p className="text-sm text-muted-foreground">
          {resultCount === 0
            ? `Ingen resultater for '${localValue}'`
            : `${resultCount} resultat${resultCount !== 1 ? "er" : ""}`}
        </p>
      )}
    </div>
  );
}
