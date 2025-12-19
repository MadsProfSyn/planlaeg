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
  selectedAfdeling: string;
  onAfdelingChange: (afdeling: string) => void;
  landsdele: string[];
  afdelinger: string[];
}

export function PlanlaegSynFiltersBar({
  selectedDate,
  onDateChange,
  selectedLandsdel,
  onLandsdelChange,
  selectedAfdeling,
  onAfdelingChange,
  landsdele,
  afdelinger,
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
      
      {/* Landsdel filter - controls inspections (left panel) */}
      <div className="w-48">
        <Select value={selectedLandsdel} onValueChange={onLandsdelChange}>
          <SelectTrigger>
            <SelectValue placeholder="Alle landsdele" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle landsdele</SelectItem>
            {landsdele.map((landsdel) => (
              <SelectItem key={landsdel} value={landsdel}>
                {landsdel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Afdeling filter - controls inspectors (right panel) */}
      <div className="w-48">
        <Select value={selectedAfdeling} onValueChange={onAfdelingChange}>
          <SelectTrigger>
            <SelectValue placeholder="Alle afdelinger" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle afdelinger</SelectItem>
            {afdelinger.map((afdeling) => (
              <SelectItem key={afdeling} value={afdeling}>
                {afdeling}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
