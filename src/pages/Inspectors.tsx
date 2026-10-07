import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Pencil, X, Trash2, RefreshCw, Users, StickyNote, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DepartmentSingleSelect } from "@/components/filters/DepartmentSingleSelect";
import { EditInspectorDialog } from "@/components/inspectors/EditInspectorDialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useInspectorWarnings, type InspectorWarning } from "@/hooks/useInspectorWarnings";
import { InspectorWarningsCard } from "@/components/inspectors/InspectorWarningsCard";

const INSPECTOR_SELECT = `
          id,
          full_name,
          email,
          phone,
          address,
          notes,
          is_active,
          department_id,
          department:departments(name),
          inspector_skills(inspection_type, is_active)
        `;

interface InspectorWithDetails {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  department_id: string | null;
  department: { name: string } | null;
  inspector_skills: Array<{
    inspection_type: string;
    is_active: boolean;
  }>;
}

const getSkillAbbreviation = (fullName: string): string => {
  const mapping: Record<string, string> = {
    Proforma: "PA",
    Projektsyn: "PS",
    Indflytningssyn: "IF",
    Fraflytningssyn: "FF",
  };
  return mapping[fullName] || fullName;
};

const getSkillBadgeVariant = (skillType: string) => {
  switch (skillType) {
    case "Proforma":
      return "default";
    case "Projektsyn":
      return "secondary";
    case "Indflytningssyn":
      return "outline";
    case "Fraflytningssyn":
      return "destructive";
    default:
      return "default";
  }
};

export default function Inspectors() {
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [editingInspector, setEditingInspector] = useState<{
    id: string;
    full_name: string;
    phone: string | null;
    address: string | null;
    notes: string | null;
    skills: string[];
    department_id: string | null;
    department_name: string | null;
  } | null>(null);
  const [deletingInspector, setDeletingInspector] = useState<InspectorWithDetails | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sortField, setSortField] = useState<"name" | "email" | "phone" | "address" | "department" | "skills" | null>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { warnings, inspectorCount: warningInspectorCount } = useInspectorWarnings();

  const handleSort = useCallback((field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }, [sortField]);


  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  // Create lookup map from department name to ID for filtering
  const departmentIdByName = useMemo(() => {
    const map: Record<string, string> = {};
    departments?.forEach(d => { map[d.name] = d.id; });
    return map;
  }, [departments]);

  const { data: inspectors, isLoading } = useQuery({
    queryKey: ["inspectors", searchQuery, departmentFilter],
    queryFn: async () => {
      let query = supabase
        .from("inspectors")
        .select(
          `
          id,
          full_name,
          email,
          phone,
          address,
          notes,
          is_active,
          department_id,
          department:departments(name),
          inspector_skills(inspection_type, is_active)
        `
        )
        .eq("is_active", true)
        .order("full_name");

      if (searchQuery) {
        query = query.or(
          `full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`
        );
      }

      if (departmentFilter && departmentIdByName[departmentFilter]) {
        query = query.eq("department_id", departmentIdByName[departmentFilter]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as InspectorWithDetails[];
    },
  });

  const sortedInspectors = useMemo(() => {
    if (!inspectors || !sortField) return inspectors;
    return [...inspectors].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.full_name.localeCompare(b.full_name, "da");
          break;
        case "email":
          cmp = a.email.localeCompare(b.email, "da");
          break;
        case "phone":
          cmp = (a.phone || "").localeCompare(b.phone || "", "da");
          break;
        case "address":
          cmp = (a.address || "").localeCompare(b.address || "", "da");
          break;
        case "department":
          cmp = (a.department?.name || "").localeCompare(b.department?.name || "", "da");
          break;
        case "skills":
          cmp = (a.inspector_skills?.filter(s => s.is_active).length || 0) - (b.inspector_skills?.filter(s => s.is_active).length || 0);
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [inspectors, sortField, sortDirection]);

  const handleEdit = (inspector: InspectorWithDetails) => {
    setEditingInspector({
      id: inspector.id,
      full_name: inspector.full_name,
      phone: inspector.phone,
      address: inspector.address,
      notes: inspector.notes,
      skills: inspector.inspector_skills
        ?.filter((s) => s.is_active)
        .map((s) => s.inspection_type) || [],
      department_id: inspector.department_id,
      department_name: inspector.department?.name || null,
    });
  };

  const refreshAfterWarningAction = () => {
    queryClient.invalidateQueries({ queryKey: ["inspectors"] });
    queryClient.invalidateQueries({ queryKey: ["inspector-warnings"] });
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["inspector-warnings"] });
    }, 4000);
  };

  const handleSaveComplete = () => {
    refreshAfterWarningAction();
  };

  const handleActivateWarning = async (w: InspectorWarning) => {
    const { error } = await supabase
      .from("inspectors")
      .update({ is_active: true, ignore_wf_warning: false })
      .eq("id", w.inspector_id);
    if (error) {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `${w.full_name} er aktiveret igen – ledige dage hentes fra WorkFeed` });
    supabase.functions.invoke("sync-availability-cron").then(({ error: syncError }) => {
      if (syncError) console.warn("sync-availability-cron failed:", syncError);
    }).catch((e) => console.warn("sync-availability-cron failed:", e));
    refreshAfterWarningAction();
  };

  const handleIgnoreWarning = async (w: InspectorWarning) => {
    const { error } = await supabase
      .from("inspectors")
      .update({ ignore_wf_warning: true })
      .eq("id", w.inspector_id);
    if (error) {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Advarslen for ${w.full_name} er skjult` });
    refreshAfterWarningAction();
  };

  const handleFixWarning = async (w: InspectorWarning) => {
    let inspector = inspectors?.find((i) => i.id === w.inspector_id);
    if (!inspector) {
      const { data, error } = await supabase
        .from("inspectors")
        .select(INSPECTOR_SELECT)
        .eq("id", w.inspector_id)
        .maybeSingle();
      if (error || !data) {
        toast({ title: "Fejl", description: "Kunne ikke hente synskonsulent", variant: "destructive" });
        return;
      }
      inspector = data as unknown as InspectorWithDetails;
    }
    handleEdit(inspector);
  };

  const handleDelete = async () => {
    if (!deletingInspector) return;
    
    const { error } = await supabase
      .from("inspectors")
      .update({ is_active: false })
      .eq("id", deletingInspector.id);
    
    if (error) {
      toast({ 
        title: "Fejl", 
        description: "Kunne ikke slette synskonsulent", 
        variant: "destructive" 
      });
    } else {
      toast({ 
        title: "Slettet", 
        description: `${deletingInspector.full_name} blev slettet` 
      });
      queryClient.invalidateQueries({ queryKey: ["inspectors"] });
    }
    
    setDeletingInspector(null);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setDepartmentFilter("");
  };

  const hasFilters = searchQuery || departmentFilter;

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-workfeed-inspectors");
      if (error) throw error;
      
      toast({
        title: "Synkronisering fuldført",
        description: `${data.new_inspectors_created} oprettet, ${data.inspectors_deactivated || 0} deaktiveret, ${data.phones_updated || 0} telefonnumre og ${data.addresses_updated || 0} adresser opdateret fra WorkFeed`
      });
      
      queryClient.invalidateQueries({ queryKey: ["inspectors"] });
    } catch (error) {
      toast({ title: "Fejl", description: "Synkronisering fejlede", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  const totalCount = inspectors?.length ?? 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <InspectorWarningsCard
        warnings={warnings}
        inspectorCount={warningInspectorCount}
        onActivate={handleActivateWarning}
        onIgnore={handleIgnoreWarning}
        onFix={handleFixWarning}
      />
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Synskonsulenter</CardTitle>
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {isLoading ? "Indlæser..." : `${totalCount} aktive synskonsulenter`}
              </p>
            </div>
            <Button onClick={handleSync} disabled={isSyncing} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Synkroniserer..." : "Synkroniser fra WorkFeed"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Søg navn, email eller telefon..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="w-full sm:w-64">
              <DepartmentSingleSelect
                departments={departments?.map(d => d.name) || []}
                selectedDepartment={departmentFilter}
                onSelectionChange={setDepartmentFilter}
                placeholder="Alle afdelinger"
              />
            </div>
            {hasFilters && (
              <Button
                variant="outline"
                onClick={clearFilters}
                className="whitespace-nowrap"
              >
                <X className="h-4 w-4 mr-2" />
                Ryd filtre
              </Button>
            )}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {([
                    ["name", "Navn"],
                    ["email", "Email"],
                    ["phone", "Telefon"],
                    ["address", "Adresse"],
                    ["department", "Afdeling"],
                    ["skills", "Kompetencer"],
                  ] as const).map(([key, label]) => (
                    <TableHead
                      key={key}
                      className="cursor-pointer select-none hover:text-foreground transition-colors"
                      onClick={() => handleSort(key)}
                    >
                      <div className="flex items-center gap-1">
                        {label}
                        {sortField === key ? (
                          sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                        )}
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={8}>
                          <Skeleton className="h-12 w-full" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                )}

                {!isLoading && inspectors?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <p className="text-muted-foreground">
                        Ingen synskonsulenter fundet
                      </p>
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading &&
                  sortedInspectors?.map((inspector) => (
                    <TableRow key={inspector.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          {inspector.full_name}
                          {inspector.notes && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <StickyNote className="h-4 w-4 text-amber-500 flex-shrink-0 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs">
                                <p className="whitespace-pre-wrap text-sm">{inspector.notes}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {inspector.email}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {inspector.phone || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate" title={inspector.address || undefined}>
                        {inspector.address || "-"}
                      </TableCell>
                      <TableCell>
                        {inspector.department?.name || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {inspector.inspector_skills
                            ?.filter((s) => s.is_active)
                            .map((skill) => (
                              <Badge
                                key={skill.inspection_type}
                                variant={getSkillBadgeVariant(
                                  skill.inspection_type
                                )}
                                className="text-xs"
                              >
                                {getSkillAbbreviation(skill.inspection_type)}
                              </Badge>
                            ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(inspector)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingInspector(inspector)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <EditInspectorDialog
        open={!!editingInspector}
        onClose={() => setEditingInspector(null)}
        inspector={editingInspector}
        onSave={handleSaveComplete}
      />

      <AlertDialog open={!!deletingInspector} onOpenChange={() => setDeletingInspector(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet synskonsulent?</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil slette {deletingInspector?.full_name}? 
              Synskonsulenten vil blive fjernet fra listen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Slet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
