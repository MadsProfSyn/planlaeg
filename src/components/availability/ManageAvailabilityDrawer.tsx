import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Calendar, Search, Users, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ConsultantWithAvailability {
  inspector_id: string;
  full_name: string;
  email: string;
  department: string | null;
  skills: string[];
  availability_status: "available" | "unavailable" | "no_record";
  source?: "workfeed" | "override";
  booked_shifts_count: number;
  start_time?: string;
  end_time?: string;
}

interface ManageAvailabilityDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const INSPECTION_TYPES = ["Proforma", "Projektsyn", "Indflytningssyn", "Fraflytningssyn"];

export function ManageAvailabilityDrawer({ open, onOpenChange, onSuccess }: ManageAvailabilityDrawerProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [showAvailable, setShowAvailable] = useState(true);
  const [showUnavailable, setShowUnavailable] = useState(true);
  const [consultants, setConsultants] = useState<ConsultantWithAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const observerTarget = useRef<HTMLDivElement>(null);

  const fetchConsultants = async (pageNum: number = 1, append: boolean = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setConsultants([]);
      setPage(1);
      setHasMore(true);
    }
    
    try {
      const { data, error } = await supabase.functions.invoke("fetch-unavailable-consultants", {
        body: {
          date: format(selectedDate, "yyyy-MM-dd"),
          search: searchQuery,
          skills: selectedSkills,
          showAvailable,
          showUnavailable,
          page: pageNum,
          pageSize: 50,
        },
      });

      if (error) throw error;
      
      if (append) {
        setConsultants(prev => [...prev, ...(data?.data || [])]);
      } else {
        setConsultants(data?.data || []);
      }
      
      setHasMore(data?.hasMore || false);
      setTotalCount(data?.total || 0);
      setPage(pageNum);
    } catch (error: any) {
      console.error("Error fetching consultants:", error);
      toast.error("Kunne ikke hente synskonsulenter");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };
  
  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      fetchConsultants(page + 1, true);
    }
  }, [page, hasMore, isLoadingMore]);

  useEffect(() => {
    if (open) {
      fetchConsultants(1, false);
    }
  }, [open, selectedDate, searchQuery, selectedSkills, showAvailable, showUnavailable]);
  
  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, isLoadingMore, loadMore]);

  const handleMakeAvailable = async (inspectorId: string, inspectorName: string) => {
    setUpdatingIds((prev) => new Set(prev).add(inspectorId));

    // Optimistic update
    setConsultants((prev) =>
      prev.map((c) =>
        c.inspector_id === inspectorId
          ? { ...c, availability_status: "available" as const, source: "override" as const }
          : c
      )
    );

    try {
      const { error } = await supabase.rpc("set_consultant_availability", {
        p_inspector_id: inspectorId,
        p_date: format(selectedDate, "yyyy-MM-dd"),
        p_is_available: true,
        p_source: "override",
      });

      if (error) throw error;

      toast.success(`${inspectorName} er nu tilgængelig ${format(selectedDate, "dd-MM-yyyy", { locale: da })}`);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error updating availability:", error);
      toast.error(error.message || "Kunne ikke opdatere tilgængelighed");
      
      // Revert optimistic update
      fetchConsultants();
    } finally {
      setUpdatingIds((prev) => {
        const updated = new Set(prev);
        updated.delete(inspectorId);
        return updated;
      });
    }
  };

  const handleMakeUnavailable = async (inspectorId: string, inspectorName: string) => {
    setUpdatingIds((prev) => new Set(prev).add(inspectorId));

    // Optimistic update
    setConsultants((prev) =>
      prev.map((c) =>
        c.inspector_id === inspectorId
          ? { ...c, availability_status: "unavailable" as const, source: "override" as const }
          : c
      )
    );

    try {
      const { error } = await supabase.rpc("set_consultant_availability", {
        p_inspector_id: inspectorId,
        p_date: format(selectedDate, "yyyy-MM-dd"),
        p_is_available: false,
        p_source: "override",
      });

      if (error) throw error;

      toast.success(`${inspectorName} er markeret som ikke tilgængelig ${format(selectedDate, "dd-MM-yyyy", { locale: da })}`);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error updating availability:", error);
      toast.error(error.message || "Kunne ikke opdatere tilgængelighed");
      
      // Revert optimistic update
      fetchConsultants();
    } finally {
      setUpdatingIds((prev) => {
        const updated = new Set(prev);
        updated.delete(inspectorId);
        return updated;
      });
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "available":
        return "default";
      case "unavailable":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "available":
        return "Tilgængelig";
      case "unavailable":
        return "Ikke tilgængelig";
      default:
        return "Ingen data";
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const isPastDate = selectedDate < new Date(new Date().setHours(0, 0, 0, 0));

  const filteredConsultants = consultants;
  
  // Split consultants by availability status
  const availableConsultants = filteredConsultants.filter(c => c.availability_status === "available");
  const unavailableConsultants = filteredConsultants.filter(c => c.availability_status !== "available");

  // Check filter toggles
  const showAvailableSection = showAvailable;
  const showUnavailableSection = showUnavailable;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[90vh] flex flex-col">
        <DrawerHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DrawerTitle>Administrer synskonsulenter</DrawerTitle>
            {totalCount > 0 && (
              <Badge variant="secondary" className="text-sm">
                Viser {consultants.length} af {totalCount}
              </Badge>
            )}
          </div>
        </DrawerHeader>

        <div className="px-4 space-y-4 flex-shrink-0">
          {/* Date Picker */}
          <div className="flex flex-col gap-2">
            <Label>Dato</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <Calendar className="mr-2 h-4 w-4" />
                  {format(selectedDate, "dd-MM-yyyy", { locale: da })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  locale={da}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  classNames={{
                    day_today: "" // Remove today's special styling
                  }}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Search */}
          <div className="flex flex-col gap-2">
            <Label>Søg efter navn</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Søg..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id="show-available"
                checked={showAvailable}
                onCheckedChange={setShowAvailable}
              />
              <Label htmlFor="show-available" className="cursor-pointer">
                Kan den dag
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="show-unavailable"
                checked={showUnavailable}
                onCheckedChange={setShowUnavailable}
              />
              <Label htmlFor="show-unavailable" className="cursor-pointer">
                Kan ikke den dag
              </Label>
            </div>
          </div>

          {/* Skills Filter */}
          <div className="flex flex-col gap-2">
            <Label>Kompetencer</Label>
            <div className="flex flex-wrap gap-2">
              {INSPECTION_TYPES.map((skill) => (
                <Badge
                  key={skill}
                  variant={selectedSkills.includes(skill) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedSkills((prev) =>
                      prev.includes(skill)
                        ? prev.filter((s) => s !== skill)
                        : [...prev, skill]
                    );
                  }}
                >
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <ScrollArea className="flex-1 min-h-0 px-4 mt-4">
          {isLoading && consultants.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredConsultants.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Ingen synskonsulenter matcher de valgte filtre</p>
              <p className="text-sm text-muted-foreground mt-2">
                Prøv at justere dine filtre eller søgning
              </p>
            </div>
          ) : (
            <div className="space-y-6 pb-4">
              {/* Available Consultants Section */}
              {showAvailableSection && availableConsultants.length > 0 && (
                <div>
                  <div className="sticky top-0 z-10 bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500 px-4 py-3 mb-3 rounded-r-lg">
                    <h3 className="text-lg font-bold text-green-700 dark:text-green-400 flex items-center gap-2">
                      Tilgængelige synskonsulenter
                      <Badge className="bg-green-600 text-white hover:bg-green-600">
                        {availableConsultants.length}
                      </Badge>
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {availableConsultants.map((consultant) => (
                      <div
                        key={consultant.inspector_id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <Avatar>
                            <AvatarFallback>{getInitials(consultant.full_name)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium truncate">{consultant.full_name}</p>
                              <Badge variant={getStatusBadgeVariant(consultant.availability_status)}>
                                {getStatusLabel(consultant.availability_status)}
                              </Badge>
                              {consultant.source === "override" && (
                                <Badge variant="outline" className="text-xs">
                                  Manuelt tilføjet
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{consultant.email}</p>
                            {consultant.skills.length > 0 && (
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {consultant.skills.map((skill) => (
                                  <Badge key={skill} variant="secondary" className="text-xs">
                                    {skill}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            {consultant.booked_shifts_count > 0 && (
                              <p className="text-xs text-amber-600 mt-1">
                                Allerede booket {consultant.booked_shifts_count}{" "}
                                {consultant.booked_shifts_count === 1 ? "gang" : "gange"} i dag
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {consultant.source === "override" ? (
                            <Button
                              onClick={() => handleMakeUnavailable(consultant.inspector_id, consultant.full_name)}
                              disabled={isPastDate || updatingIds.has(consultant.inspector_id)}
                              size="sm"
                              variant="outline"
                            >
                              {updatingIds.has(consultant.inspector_id) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Gør ikke tilgængelig"
                              )}
                            </Button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="text-sm text-muted-foreground">Tilgængelig via WorkFeed</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unavailable Consultants Section */}
              {showUnavailableSection && unavailableConsultants.length > 0 && (
                <div>
                  <div className="sticky top-0 z-10 bg-red-50 dark:bg-red-950/20 border-l-4 border-red-500 px-4 py-3 mb-3 rounded-r-lg">
                    <h3 className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                      Ikke tilgængelige
                      <Badge className="bg-red-600 text-white hover:bg-red-600">
                        {unavailableConsultants.length}
                      </Badge>
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {unavailableConsultants.map((consultant) => (
                      <div
                        key={consultant.inspector_id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <Avatar>
                            <AvatarFallback>{getInitials(consultant.full_name)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium truncate">{consultant.full_name}</p>
                              <Badge variant={getStatusBadgeVariant(consultant.availability_status)}>
                                {getStatusLabel(consultant.availability_status)}
                              </Badge>
                              {consultant.source === "override" && (
                                <Badge variant="outline" className="text-xs">
                                  Manuelt tilføjet
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{consultant.email}</p>
                            {consultant.skills.length > 0 && (
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {consultant.skills.map((skill) => (
                                  <Badge key={skill} variant="secondary" className="text-xs">
                                    {skill}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            {consultant.booked_shifts_count > 0 && (
                              <p className="text-xs text-amber-600 mt-1">
                                Allerede booket {consultant.booked_shifts_count}{" "}
                                {consultant.booked_shifts_count === 1 ? "gang" : "gange"} i dag
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            onClick={() => handleMakeAvailable(consultant.inspector_id, consultant.full_name)}
                            disabled={isPastDate || updatingIds.has(consultant.inspector_id)}
                            size="sm"
                          >
                            {updatingIds.has(consultant.inspector_id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Gør tilgængelig"
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Infinite scroll trigger */}
              {hasMore && (
                <div ref={observerTarget} className="flex justify-center py-4">
                  {isLoadingMore && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm">Henter flere...</span>
                    </div>
                  )}
                </div>
              )}
              
              {!hasMore && consultants.length > 0 && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  Alle synskonsulenter er hentet
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <DrawerFooter className="flex-shrink-0">
          <DrawerClose asChild>
            <Button variant="outline">Luk</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
