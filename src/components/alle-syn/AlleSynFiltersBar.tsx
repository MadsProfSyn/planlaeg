import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlobalSearchInput } from "@/components/filters/GlobalSearchInput";
import { SingleDatePicker } from "@/components/filters/SingleDatePicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AlleSynFiltersBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  regions: string[];
  selectedRegion: string;
  onRegionChange: (value: string) => void;
  date: string;
  onDateChange: (value: string) => void;
  onClearAll: () => void;
  hasFilters: boolean;
  resultCount: number;
  isLoading: boolean;
}

export function AlleSynFiltersBar({
  searchQuery,
  onSearchChange,
  regions,
  selectedRegion,
  onRegionChange,
  date,
  onDateChange,
  onClearAll,
  hasFilters,
  resultCount,
  isLoading,
}: AlleSynFiltersBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <GlobalSearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Søg kunde, adresse, lejemålsnr..."
          className="w-64"
        />

        <SingleDatePicker value={date} onChange={onDateChange} />

        <Select value={selectedRegion || "all"} onValueChange={(v) => onRegionChange(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Alle landsdele" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle landsdele</SelectItem>
            {regions.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onClearAll}>
            <X className="h-4 w-4 mr-1" /> Ryd filtre
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <span>{resultCount} synsopgaver</span>
        )}

        {searchQuery && <Badge variant="secondary">Søgning: {searchQuery}</Badge>}
        {selectedRegion && <Badge variant="secondary">{selectedRegion}</Badge>}
        {date && <Badge variant="secondary">{date}</Badge>}
      </div>
    </div>
  );
}
