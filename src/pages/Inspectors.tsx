import { useState } from "react";
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
import { Search, Pencil, X } from "lucide-react";
import { DepartmentSingleSelect } from "@/components/filters/DepartmentSingleSelect";
import { EditInspectorDialog } from "@/components/inspectors/EditInspectorDialog";
import { Skeleton } from "@/components/ui/skeleton";

interface InspectorWithDetails {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  address: string | null;
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
    skills: string[];
    department_id: string | null;
    department_name: string | null;
  } | null>(null);
  const queryClient = useQueryClient();

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("name")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data.map((d) => d.name);
    },
  });

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

      if (departmentFilter) {
        query = query.eq("department.name", departmentFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as InspectorWithDetails[];
    },
  });

  const handleEdit = (inspector: InspectorWithDetails) => {
    setEditingInspector({
      id: inspector.id,
      full_name: inspector.full_name,
      phone: inspector.phone,
      address: inspector.address,
      skills: inspector.inspector_skills
        ?.filter((s) => s.is_active)
        .map((s) => s.inspection_type) || [],
      department_id: inspector.department_id,
      department_name: inspector.department?.name || null,
    });
  };

  const handleSaveComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["inspectors"] });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setDepartmentFilter("");
  };

  const hasFilters = searchQuery || departmentFilter;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Synskonsulenter</CardTitle>
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
                departments={departments || []}
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
                  <TableHead>Navn</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead>Afdeling</TableHead>
                  <TableHead>Kompetencer</TableHead>
                  <TableHead className="text-right">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={7}>
                          <Skeleton className="h-12 w-full" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                )}

                {!isLoading && inspectors?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <p className="text-muted-foreground">
                        Ingen synskonsulenter fundet
                      </p>
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading &&
                  inspectors?.map((inspector) => (
                    <TableRow key={inspector.id}>
                      <TableCell className="font-medium">
                        {inspector.full_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {inspector.email}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {inspector.phone || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(inspector)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
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
    </div>
  );
}
