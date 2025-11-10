import * as React from "react";
import { Search, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface InspectorSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  inspectionType: string;
  onSelect: (inspectorId: string, inspectorName: string) => void;
}

export function InspectorSelector({
  open,
  onOpenChange,
  date,
  inspectionType,
  onSelect,
}: InspectorSelectorProps) {
  const [search, setSearch] = React.useState("");

  const { data: inspectors = [], isLoading } = useQuery({
    queryKey: ["available-inspectors", date, inspectionType],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "fetch-available-inspectors",
        {
          body: {
            from: date,
            to: date,
            synstyper: [inspectionType],
            synstyper_all: false,
            afdeling: null,
            q: '',
            page: 1,
            pageSize: 9999,
            no_pagination: true,
            sortBy: 'navn',
            sortOrder: 'asc'
          },
        }
      );
      if (error) throw error;
      return data?.data || [];
    },
    enabled: open && !!date && !!inspectionType,
  });

  const filteredInspectors = React.useMemo(() => {
    return inspectors.filter((inspector: any) => {
      const name = inspector?.navn || inspector?.full_name || '';
      const matchesSearch = name.toLowerCase().includes(search.toLowerCase());
      return matchesSearch;
    });
  }, [inspectors, search]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const hasRequiredSkill = (inspector: any) => {
    const types: string[] = inspector?.synstyper || [];
    return types.some((t) => (t || '').toLowerCase() === (inspectionType || '').toLowerCase());
  };
  const getTimeRanges = (inspector: any) => {
    const start = inspector?.start_tid || inspector?.start_time_local;
    const end = inspector?.slut_tid || inspector?.end_time_local;
    if (start && end) {
      return [{ start_time: start, end_time: end }];
    }
    return [];
  };
  const getAvailabilitySource = (inspector: any) => {
    return inspector.supabase_availability?.[0]?.source || "workfeed";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Vælg inspektør</DialogTitle>
          <DialogDescription>
            Vælg en tilgængelig inspektør for {date}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Søg efter navn..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[400px] pr-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Indlæser inspektører...
              </div>
            ) : filteredInspectors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Ingen tilgængelige inspektører fundet
              </div>
            ) : (
              <div className="space-y-2">
                {filteredInspectors.map((inspector: any) => {
                  const hasSkill = hasRequiredSkill(inspector);
                  const timeRanges = getTimeRanges(inspector);

                  return (
                    <button
                      key={inspector.inspector_uuid || inspector.id}
                      onClick={() => {
                        onSelect(inspector.inspector_uuid || inspector.id, inspector.navn || inspector.full_name);
                        onOpenChange(false);
                      }}
                      className="w-full p-4 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getInitials((inspector.navn || inspector.full_name || ''))}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{inspector.navn || inspector.full_name}</h4>
                            {hasSkill ? (
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-warning" />
                            )}
                          </div>

                          <div className="flex flex-wrap gap-1 mb-2">
                            {hasSkill ? (
                              <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                                Kvalificeret
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/20">
                                Mangler kompetence
                              </Badge>
                            )}
                          </div>

                          {timeRanges.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {timeRanges.map((range: any, idx: number) => (
                                <span key={idx}>
                                  {range.start_time.slice(0, 5)}-{range.end_time.slice(0, 5)}
                                  {idx < timeRanges.length - 1 && ", "}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
