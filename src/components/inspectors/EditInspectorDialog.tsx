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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface EditInspectorDialogProps {
  open: boolean;
  onClose: () => void;
  inspector: {
    id: string;
    full_name: string;
    phone: string | null;
    address: string | null;
    skills: string[];
  } | null;
  onSave: () => void;
}

const SKILL_OPTIONS = [
  { value: "Proforma", label: "Proforma (PA)" },
  { value: "Projektsyn", label: "Projektsyn (PS)" },
  { value: "Indflytningssyn", label: "Indflytningssyn (IF)" },
  { value: "Fraflytningssyn", label: "Fraflytningssyn (FF)" },
];

export function EditInspectorDialog({
  open,
  onClose,
  inspector,
  onSave,
}: EditInspectorDialogProps) {
  const [formData, setFormData] = useState({
    phone: "",
    address: "",
    skills: [] as string[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (inspector && open) {
      setFormData({
        phone: inspector.phone || "",
        address: inspector.address || "",
        skills: inspector.skills || [],
      });
    } else {
      setFormData({
        phone: "",
        address: "",
        skills: [],
      });
    }
  }, [inspector, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspector) return;
    
    setIsSubmitting(true);

    try {
      // 1. Update phone and address
      const { error: updateError } = await supabase
        .from("inspectors")
        .update({
          phone: formData.phone || null,
          address: formData.address || null,
        })
        .eq("id", inspector.id);

      if (updateError) throw updateError;

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
