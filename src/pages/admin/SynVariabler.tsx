import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Save } from "lucide-react";

const INSPECTION_TYPES = ["FF", "IF", "PS", "PA"] as const;
const ROOM_COUNTS = [1, 2, 3, 4, 5, 6];

type DurationMatrix = Record<string, Record<number, number>>;
type Modifier = { modifier_name: string; minutes: number; applies_to: string[] };

export default function SynVariabler() {
  const { toast } = useToast();
  const [matrix, setMatrix] = useState<DurationMatrix>({});
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [durRes, modRes] = await Promise.all([
      supabase.from("inspection_durations").select("*"),
      supabase.from("inspection_duration_modifiers" as any).select("*"),
    ]);

    if (durRes.data) {
      const m: DurationMatrix = {};
      for (const row of durRes.data) {
        if (!m[row.inspection_type]) m[row.inspection_type] = {};
        m[row.inspection_type][row.rooms] = row.minutes;
      }
      setMatrix(m);
    }

    if (modRes.data) {
      setModifiers(modRes.data as any as Modifier[]);
    }

    setLoading(false);
  }

  function updateCell(type: string, rooms: number, value: number) {
    setMatrix((prev) => ({
      ...prev,
      [type]: { ...prev[type], [rooms]: value },
    }));
  }

  function updateModifier(name: string, minutes: number) {
    setModifiers((prev) =>
      prev.map((m) => (m.modifier_name === name ? { ...m, minutes } : m))
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Update duration matrix
      const updates = [];
      for (const type of INSPECTION_TYPES) {
        for (const rooms of ROOM_COUNTS) {
          const minutes = matrix[type]?.[rooms];
          if (minutes != null) {
            updates.push(
              supabase
                .from("inspection_durations")
                .update({ minutes })
                .eq("inspection_type", type)
                .eq("rooms", rooms)
            );
          }
        }
      }

      // Update modifiers
      for (const mod of modifiers) {
        updates.push(
          (supabase as any)
            .from("inspection_duration_modifiers")
            .update({ minutes: mod.minutes })
            .eq("modifier_name", mod.modifier_name)
        );
      }

      const results = await Promise.all(updates);
      const hasError = results.some((r) => r.error);

      if (hasError) {
        toast({ title: "Fejl", description: "Kunne ikke gemme alle ændringer", variant: "destructive" });
      } else {
        // Clear cached duration matrix so frontend picks up new values
        const { clearDurationCache } = await import("@/lib/inspection-duration");
        clearDurationCache();
        toast({ title: "Gemt", description: "Syn variabler er opdateret" });
      }
    } catch (err) {
      toast({ title: "Fejl", description: "Uventet fejl ved gemning", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Syn variabler</h1>
          <p className="text-sm text-muted-foreground">
            Rediger varighed (minutter) pr. synstype og antal værelser
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Gem ændringer
        </Button>
      </div>

      {/* Duration Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Varigheder (minutter)</CardTitle>
          <CardDescription>
            FF = Fraflytningssyn, IF = Indflytningssyn, PS = Projektsyn, PA = Proforma
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Værelser</TableHead>
                {INSPECTION_TYPES.map((type) => (
                  <TableHead key={type} className="text-center w-[120px]">
                    {type}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROOM_COUNTS.map((rooms) => (
                <TableRow key={rooms}>
                  <TableCell className="font-medium">{rooms} rum</TableCell>
                  {INSPECTION_TYPES.map((type) => (
                    <TableCell key={type} className="text-center">
                      <Input
                        type="number"
                        min={0}
                        max={300}
                        className="w-20 mx-auto text-center"
                        value={matrix[type]?.[rooms] ?? ""}
                        onChange={(e) =>
                          updateCell(type, rooms, parseInt(e.target.value) || 0)
                        }
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modifiers */}
      <Card>
        <CardHeader>
          <CardTitle>Tillæg (ekstra minutter)</CardTitle>
          <CardDescription>
            Ekstra tid der lægges til synsvarigheden baseret på specielle forhold
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {modifiers.map((mod) => (
              <div key={mod.modifier_name} className="flex items-center gap-4">
                <span className="font-medium w-40">{mod.modifier_name}</span>
                <Input
                  type="number"
                  min={0}
                  max={120}
                  className="w-20 text-center"
                  value={mod.minutes}
                  onChange={(e) =>
                    updateModifier(mod.modifier_name, parseInt(e.target.value) || 0)
                  }
                />
                <span className="text-sm text-muted-foreground">
                  min (gælder: {mod.applies_to.join(", ")})
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
