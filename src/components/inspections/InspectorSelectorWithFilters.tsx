import * as React from "react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, CheckCircle2, AlertTriangle, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DepartmentMultiSelect } from "@/components/filters/DepartmentMultiSelect";
import { DateRangePicker } from "@/components/filters/DateRangePicker";
import { SynsTypeMultiSelect } from "@/components/filters/SynsTypeMultiSelect";
import { GlobalSearchInput } from "@/components/filters/GlobalSearchInput";
import { Card } from "@/components/ui/card";
import { Search, RotateCcw } from "lucide-react";

interface InspectorSelectorWithFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspectionType: string;
  preferredDate: string;
  onSelect: (inspectorId: string | null, inspectorName: string | null) => void;
  currentSelection?: { inspectorId: string | null; inspectorName: string | null };
}

interface AvailableInspector {
  inspector_uuid: string;
  navn: string;
  afdeling: string;
  synstyper: string[];
  adresse: string;
  dato: string;
  start_tid: string | null;
  slut_tid: string | null;
  tidspunkt_label: string;
  scheduled_shifts: number;
  shift_details: Array<{
    type: string;
    start_time: string;
    end_time: string;
    duration_minutes: number;
    address?: string;
  }>;
  booked_minutes?: number;
  capacity_status?: string | null;
}

const INSPECTION_TYPES = [
  { code: "Proforma", label: "Proforma" },
  { code: "Projektsyn", label: "Projektsyn" },
  { code: "Indflytningssyn", label: "Indflytningssyn" },
  { code: "Fraflytningssyn", label: "Fraflytningssyn" },
];

export function InspectorSelectorWithFilters({
  open,
  onOpenChange,
  inspectionType,
  preferredDate,
  onSelect,
  currentSelection,
}: InspectorSelectorWithFiltersProps) {
  const [inspectors, setInspectors] = useState<AvailableInspector[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);
  
  const [filters, setFilters] = useState({
    afdeling: [] as string[],
    from: preferredDate,
    to: preferredDate,
    synstyper: [inspectionType],
    synstyper_all: false,
    q: '',
  });

  // Fetch departments on mount
  useEffect(() => {
    const fetchDepartments = async () => {
      const { data } = await supabase
        .from("departments")
        .select("name")
        .eq("is_active", true)
        .order("name");
      
      if (data) {
        setDepartments(data.map(d => d.name));
      }
    };
    
    fetchDepartments();
  }, []);

  // Fetch inspectors when modal opens or filters change
  useEffect(() => {
    if (!open) return;
    
    const fetchInspectors = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke(
          "fetch-available-inspectors",
          {
            body: {
              ...filters,
              page: 1,
              pageSize: 9999,
              no_pagination: true,
              sortBy: 'navn',
              sortOrder: 'asc'
            },
          }
        );

        if (error) throw error;
        setInspectors(data.data || []);
      } catch (error) {
        console.error("Failed to fetch inspectors:", error);
        setInspectors([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInspectors();
  }, [open, filters]);

  const handleSearch = () => {
    // Trigger re-fetch by updating filters
    setFilters({ ...filters });
  };

  const handleReset = () => {
    setFilters({
      afdeling: [],
      from: preferredDate,
      to: preferredDate,
      synstyper: [],
      synstyper_all: true,
      q: '',
    });
  };

  const updateFilter = (key: string, value: any) => {
    const newFilters = { ...filters, [key]: value };
    
    if (key === "synstyper") {
      const allTypes = INSPECTION_TYPES.map(t => t.code);
      const isAllSelected = value.length === allTypes.length && 
        allTypes.every((type: string) => value.includes(type));
      newFilters.synstyper_all = isAllSelected;
    }
    
    setFilters(newFilters);
  };

  const handleDateRangeChange = (dateFrom?: string, dateTo?: string) => {
    const newFilters = { ...filters };
    if (dateFrom) {
      newFilters.from = dateFrom;
    }
    if (dateTo) {
      newFilters.to = dateTo;
    }
    setFilters(newFilters);
  };

  const handleSelectInspector = (inspector: AvailableInspector) => {
    onSelect(inspector.inspector_uuid, inspector.navn);
    onOpenChange(false);
  };

  const handleSelectAutomatic = () => {
    onSelect(null, null);
    onOpenChange(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const hasRequiredSkill = (inspectorSkills: string[]) => {
    return inspectorSkills.some(skill => 
      skill.toLowerCase() === inspectionType.toLowerCase()
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Vælg anden inspektør for {inspectionType}
          </DialogTitle>
        </DialogHeader>

        {/* Filters Bar */}
        <Card className="p-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Afdeling
              </label>
              <DepartmentMultiSelect
                departments={departments}
                selectedDepartments={filters.afdeling}
                onSelectionChange={(depts) => updateFilter("afdeling", depts)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Dato interval
              </label>
              <DateRangePicker
                dateFrom={filters.from}
                dateTo={filters.to}
                onDateChange={handleDateRangeChange}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Synstyper
              </label>
              <SynsTypeMultiSelect
                synsTypes={INSPECTION_TYPES}
                selectedTypes={filters.synstyper}
                onSelectionChange={(types) => updateFilter("synstyper", types)}
                placeholder="Vælg synstyper"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Fri søgning
              </label>
              <GlobalSearchInput
                value={filters.q}
                onChange={(value) => updateFilter("q", value)}
                placeholder="Søg navn, adresse..."
              />
            </div>

            <div className="flex items-end gap-2">
              <Button
                onClick={handleSearch}
                disabled={isLoading}
                className="flex-1"
                size="default"
              >
                <Search className="h-4 w-4 mr-2" />
                Søg
              </Button>
              <Button
                onClick={handleReset}
                variant="outline"
                size="default"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Inspectors List */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-[400px] pr-4">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : inspectors.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-base font-medium mb-1">Ingen tilgængelige inspektører</p>
                <p className="text-sm">Justér filtre eller søgning</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Automatic VRP option */}
                <button
                  onClick={handleSelectAutomatic}
                  className="w-full p-4 border-2 border-dashed rounded-lg hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">VRP tildeler automatisk</p>
                      <p className="text-sm text-muted-foreground">
                        Lad systemet vælge den optimale inspektør
                      </p>
                    </div>
                  </div>
                </button>

                {inspectors.map((inspector) => {
                  const hasSkill = hasRequiredSkill(inspector.synstyper);
                  const isSelected = currentSelection?.inspectorId === inspector.inspector_uuid;

                  return (
                    <button
                      key={inspector.inspector_uuid}
                      onClick={() => handleSelectInspector(inspector)}
                      className={`w-full p-4 border rounded-lg hover:bg-muted/50 transition-colors text-left ${
                        isSelected ? 'border-primary bg-primary/5' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                            {getInitials(inspector.navn)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium truncate">{inspector.navn}</p>
                            {isSelected && (
                              <Badge variant="default" className="text-xs">
                                Valgt
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              {inspector.afdeling}
                            </Badge>
                            <Badge 
                              variant="secondary" 
                              className="text-xs bg-green-500/10 text-green-700 border-green-500/20"
                            >
                              Tilgængelig fra WorkFeed
                            </Badge>
                          </div>

                          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {inspector.tidspunkt_label}
                            </div>
                            {inspector.scheduled_shifts > 0 && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {inspector.scheduled_shifts} syn booket
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {hasSkill ? (
                              <div className="flex items-center gap-1 text-xs text-green-600">
                                <CheckCircle2 className="h-3 w-3" />
                                Har kompetence: {inspectionType}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-xs text-amber-600">
                                <AlertTriangle className="h-3 w-3" />
                                Mangler kompetence: {inspectionType}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-1 mt-2">
                            {inspector.synstyper.map((type) => (
                              <Badge 
                                key={type} 
                                variant="secondary" 
                                className="text-xs"
                              >
                                {type}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuller
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
