import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface EditInspectorDialogProps {
  open: boolean;
  onClose: () => void;
  inspector: {
    id: string;
    full_name: string;
    phone: string | null;
    address: string | null;
    notes: string | null;
    skills: string[];
    department_id: string | null;
    department_name: string | null;
  } | null;
  onSave: () => void;
}

const SKILL_OPTIONS = [
  { value: "Proforma", label: "Proforma (PA)" },
  { value: "Projektsyn", label: "Projektsyn (PS)" },
  { value: "Indflytningssyn", label: "Indflytningssyn (IF)" },
  { value: "Fraflytningssyn", label: "Fraflytningssyn (FF)" },
];

const NO_DEPARTMENT = "__none__";

export function EditInspectorDialog({
  open,
  onClose,
  inspector,
  onSave,
}: EditInspectorDialogProps) {
  const [formData, setFormData] = useState({
    phone: "",
    address: "",
    notes: "",
    skills: [] as string[],
    departmentId: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const { data: departments } = useQuery({
    queryKey: ["departments-list"],
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

  useEffect(() => {
    if (inspector && open) {
      setFormData({
        phone: inspector.phone || "",
        address: inspector.address || "",
        notes: inspector.notes || "",
        skills: inspector.skills || [],
        departmentId: inspector.department_id || NO_DEPARTMENT,
      });
    } else {
      setFormData({
        phone: "",
        address: "",
        notes: "",
        skills: [],
        departmentId: NO_DEPARTMENT,
      });
    }
  }, [inspector, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspector) return;
    
    setIsSubmitting(true);

    try {
      const addressChanged = (formData.address || '') !== (inspector.address || '');

      // 1. Update phone, address, and department
      const { error: updateError } = await supabase
        .from("inspectors")
        .update({
          phone: formData.phone || null,
          address: formData.address || null,
          notes: formData.notes || null,
          department_id: formData.departmentId === NO_DEPARTMENT ? null : formData.departmentId,
        })
        .eq("id", inspector.id);

      if (updateError) throw updateError;

      // Trigger geocoding in background if address changed
      if (addressChanged) {
        supabase.functions.invoke("geocode-inspector", {
          body: { inspector_id: inspector.id },
        }).catch((err) => console.error("Background geocoding failed:", err));
      }

      // 2. Fetch existing skills
      const { data: existingSkills, error: skillsError } = await supabase
        .from("inspector_skills")
        .select("*")
        .eq("inspector_id", inspector.id);

      if (skillsError) throw skillsError;

      // 3. Determine which skills to add/remove
      const selectedSkills = formData.skills;
      const existingActiveSkills = existingSkills
        .filter((s) => s.is_active)
        .map((s) => s.inspection_type);

      const toAdd = selectedSkills.filter(
        (skill) => !existingActiveSkills.includes(skill)
      );
      const toDeactivate = existingActiveSkills.filter(
        (skill) => !selectedSkills.includes(skill)
      );

      // 4. Add new skills
      if (toAdd.length > 0) {
        // Check if skill exists but is inactive - reactivate it
        const existingInactive = existingSkills.filter(
          (s) => !s.is_active && toAdd.includes(s.inspection_type)
        );

        // Reactivate existing inactive skills
        for (const skill of existingInactive) {
          await supabase
            .from("inspector_skills")
            .update({ is_active: true })
            .eq("id", skill.id);
        }

        // Insert truly new skills
        const newSkills = toAdd.filter(
          (skill) => !existingSkills.some((s) => s.inspection_type === skill)
        );

        if (newSkills.length > 0) {
          const { error: insertError } = await supabase
            .from("inspector_skills")
            .insert(
              newSkills.map((skill) => ({
                inspector_id: inspector.id,
                inspection_type: skill,
                is_active: true,
              }))
            );

          if (insertError) throw insertError;
        }
      }

      // 5. Deactivate removed skills
      if (toDeactivate.length > 0) {
        const skillsToDeactivate = existingSkills
          .filter((s) => toDeactivate.includes(s.inspection_type))
          .map((s) => s.id);

        const { error: deactivateError } = await supabase
          .from("inspector_skills")
          .update({ is_active: false })
          .in("id", skillsToDeactivate);

        if (deactivateError) throw deactivateError;
      }

      toast({
        title: "Gemt",
        description: `Synskonsulent ${inspector.full_name} blev opdateret`,
      });

      onSave();
      onClose();
    } catch (error: any) {
      console.error("Error saving inspector:", error);
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke gemme ændringer",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!inspector) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Rediger synskonsulent: {inspector.full_name}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input
              id="phone"
              type="text"
              placeholder="12 34 56 78"
              value={formData.phone}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, phone: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Adresse</Label>
            <Input
              id="address"
              type="text"
              placeholder="Hovedgaden 1, 1000 København"
              value={formData.address}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, address: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="department">Afdeling</Label>
            <Select
              value={formData.departmentId}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, departmentId: value }))
              }
            >
              <SelectTrigger id="department">
                <SelectValue placeholder="Vælg afdeling" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_DEPARTMENT}>Ingen afdeling</SelectItem>
                {departments?.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Noter</Label>
            <Textarea
              id="notes"
              placeholder="Tilføj noter om synskonsulenten (f.eks. præferencer, begrænsninger)..."
              value={formData.notes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              rows={3}
            />
          </div>

          <div className="space-y-3">
            <Label>Kompetencer (Synstyper)</Label>
            <div className="space-y-2">
              {SKILL_OPTIONS.map((skill) => (
                <div key={skill.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={skill.value}
                    checked={formData.skills.includes(skill.value)}
                    onCheckedChange={(checked) => {
                      setFormData((prev) => ({
                        ...prev,
                        skills: checked
                          ? [...prev.skills, skill.value]
                          : prev.skills.filter((s) => s !== skill.value),
                      }));
                    }}
                  />
                  <Label
                    htmlFor={skill.value}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {skill.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuller
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gem ændringer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
