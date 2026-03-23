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
import { Textarea } from "@/components/ui/textarea";
import { MondayItem } from "@/lib/supabase";
import { calculateInspectionDuration } from "@/lib/inspection-duration";

interface EditMondayItemDialogProps {
  open: boolean;
  onClose: () => void;
  item: MondayItem | null;
  onSave: (id: number, updates: Partial<MondayItem>) => Promise<void>;
}

export function EditMondayItemDialog({ open, onClose, item, onSave }: EditMondayItemDialogProps) {
  const [formData, setFormData] = useState({
    Kunde: "",
    adresse: "",
    synstype: "",
    dato_tid: "",
    antal_vaerelser: "" as string,
    note: "",
    duration_minutes: "" as string,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const autoDuration = item
    ? calculateInspectionDuration({
        synstype: item.synstype,
        antalVaerelser: item.antal_vaerelser,
        raw: item.raw,
      })
    : 45;

  useEffect(() => {
    if (item) {
      const rawNote = item.raw
        ? (typeof item.raw === "string" ? JSON.parse(item.raw) : item.raw)?.Note || ""
        : "";
      setFormData({
        Kunde: item.Kunde || "",
        adresse: item.adresse || "",
        synstype: item.synstype || "",
        dato_tid: item.dato_tid
          ? new Date(item.dato_tid).toISOString().slice(0, 16)
          : "",
        antal_vaerelser: item.antal_vaerelser?.toString() || "",
        note: (item as any).note || rawNote,
        duration_minutes: (item as any).duration_minutes?.toString() || "",
      });
    }
  }, [item, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    setIsSubmitting(true);
    try {
      const updates: any = {
        Kunde: formData.Kunde || null,
        adresse: formData.adresse || null,
        synstype: formData.synstype || null,
        dato_tid: formData.dato_tid || null,
        antal_vaerelser: formData.antal_vaerelser ? parseInt(formData.antal_vaerelser) : null,
        note: formData.note || null,
        duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : null,
      };
      await onSave(item.id, updates);
      onClose();
    } catch {
      // toast handled in parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rediger syn</DialogTitle>
          <DialogDescription>Opdater oplysninger for dette syn</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="edit-kunde">Kunde</Label>
            <Input id="edit-kunde" value={formData.Kunde} onChange={(e) => setFormData((f) => ({ ...f, Kunde: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-adresse">Adresse</Label>
            <Input id="edit-adresse" value={formData.adresse} onChange={(e) => setFormData((f) => ({ ...f, adresse: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-synstype">Synstype</Label>
              <Input id="edit-synstype" value={formData.synstype} onChange={(e) => setFormData((f) => ({ ...f, synstype: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-rooms">Antal værelser</Label>
              <Input id="edit-rooms" type="number" value={formData.antal_vaerelser} onChange={(e) => setFormData((f) => ({ ...f, antal_vaerelser: e.target.value }))} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-dato">Dato & Tid</Label>
            <Input id="edit-dato" type="datetime-local" value={formData.dato_tid} onChange={(e) => setFormData((f) => ({ ...f, dato_tid: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-note">Note</Label>
            <Textarea id="edit-note" value={formData.note} onChange={(e) => setFormData((f) => ({ ...f, note: e.target.value }))} rows={2} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-duration">Varighed (minutter)</Label>
            <Input
              id="edit-duration"
              type="number"
              value={formData.duration_minutes}
              onChange={(e) => setFormData((f) => ({ ...f, duration_minutes: e.target.value }))}
              placeholder={`${autoDuration} (auto)`}
            />
            <p className="text-xs text-muted-foreground">
              Lad feltet stå tomt for automatisk beregning ({autoDuration} min).
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Annuller</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Gemmer..." : "Gem ændringer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
