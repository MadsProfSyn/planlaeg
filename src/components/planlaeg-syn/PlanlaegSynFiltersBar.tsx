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
  selectedAfdeling: string;
  onAfdelingChange: (afdeling: string) => void;
  afdelinger: string[];
}

export function PlanlaegSynFiltersBar({
  selectedDate,
  onDateChange,
  selectedAfdeling,
  onAfdelingChange,
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
