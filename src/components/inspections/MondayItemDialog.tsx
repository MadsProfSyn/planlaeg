import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MondayItem } from "@/lib/supabase";

interface MondayItemDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (item: Partial<MondayItem>) => Promise<void>;
  item?: MondayItem | null;
}

export function MondayItemDialog({ open, onClose, onSave, item }: MondayItemDialogProps) {
  const [formData, setFormData] = useState<Partial<MondayItem>>({
    name: "",
    adresse: "",
    synstype: "",
    dato_tid: "",
    antal_vaerelser: undefined,
    Kunde: "",
    lejemalsnr: "",
    landsdel: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || "",
        adresse: item.adresse || "",
        synstype: item.synstype || "",
        dato_tid: item.dato_tid || "",
        antal_vaerelser: item.antal_vaerelser || undefined,
        Kunde: item.Kunde || "",
        lejemalsnr: item.lejemalsnr || "",
        landsdel: item.landsdel || "",
      });
    } else {
      setFormData({
        name: "",
        adresse: "",
        synstype: "",
        dato_tid: "",
        antal_vaerelser: undefined,
        Kunde: "",
        lejemalsnr: "",
        landsdel: "",
      });
    }
  }, [item, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error("Failed to save item:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof MondayItem, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Rediger syn" : "Tilføj nyt syn"}</DialogTitle>
          <DialogDescription>Udfyld formularen for at {item ? "opdatere" : "oprette"} et syn</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Type</Label>
              <Input
                id="name"
                value={formData.name || ""}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Syn type"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="adresse">Adresse *</Label>
              <Input
                id="adresse"
                value={formData.adresse || ""}
                onChange={(e) => handleChange("adresse", e.target.value)}
                placeholder="Adresse"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="synstype">Synstype</Label>
                <Input
                  id="synstype"
                  value={formData.synstype || ""}
                  onChange={(e) => handleChange("synstype", e.target.value)}
                  placeholder="F.eks. Indflytning"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="antal_vaerelser">Antal værelser</Label>
                <Input
                  id="antal_vaerelser"
                  type="number"
                  value={formData.antal_vaerelser || ""}
                  onChange={(e) =>
                    handleChange("antal_vaerelser", e.target.value ? parseInt(e.target.value) : undefined)
                  }
                  placeholder="3"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dato_tid">Dato & Tid</Label>
              <Input
                id="dato_tid"
                type="datetime-local"
                value={formData.dato_tid ? new Date(formData.dato_tid).toISOString().slice(0, 16) : ""}
                onChange={(e) => handleChange("dato_tid", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="Kunde">Kunde</Label>
                <Input
                  id="Kunde"
                  value={formData.Kunde || ""}
                  onChange={(e) => handleChange("Kunde", e.target.value)}
                  placeholder="Kunde navn"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lejemalsnr">Lejemålsnr.</Label>
                <Input
                  id="lejemalsnr"
                  value={formData.lejemalsnr || ""}
                  onChange={(e) => handleChange("lejemalsnr", e.target.value)}
                  placeholder="123456"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="landsdel">Landsdel</Label>
              <Input
                id="landsdel"
                value={formData.landsdel || ""}
                onChange={(e) => handleChange("landsdel", e.target.value)}
                placeholder="F.eks. København"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Annuller
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Gemmer..." : item ? "Gem ændringer" : "Opret syn"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
