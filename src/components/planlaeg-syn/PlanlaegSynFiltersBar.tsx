import { SingleDatePicker } from "@/components/filters/SingleDatePicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PlanlaegSynFiltersBarProps {
  selectedDate?: string;
  onDateChange: (date?: string) => void;
  selectedLandsdel: string;
  onLandsdelChange: (landsdel: string) => void;
  regions: string[];
}

export function PlanlaegSynFiltersBar({
  selectedDate,
  onDateChange,
  selectedLandsdel,
  onLandsdelChange,
  regions,
}: PlanlaegSynFiltersBarProps) {
  return (
    <div className="flex flex-wrap gap-4 items-center">
      <div className="w-48">
        <SingleDatePicker
          date={selectedDate}
          onDateChange={onDateChange}
          placeholder="Vælg dato"
        />
      </div>
      
      <div className="w-48">
        <Select value={selectedLandsdel} onValueChange={onLandsdelChange}>
          <SelectTrigger>
            <SelectValue placeholder="Alle landsdele" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle landsdele</SelectItem>
            {regions.map((region) => (
              <SelectItem key={region} value={region}>
                {region}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
