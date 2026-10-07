import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { InspectorWarning } from "@/hooks/useInspectorWarnings";

interface Props {
  warnings: InspectorWarning[];
  inspectorCount: number;
  onActivate: (w: InspectorWarning) => void;
  onIgnore: (w: InspectorWarning) => void;
  onFix: (w: InspectorWarning) => void;
}

export function InspectorWarningsCard({ warnings, inspectorCount, onActivate, onIgnore, onFix }: Props) {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const sections = useMemo(() => {
    const map = new Map<string, { warning: string; label: string; priority: number; rows: InspectorWarning[] }>();
    for (const w of warnings) {
      if (!map.has(w.warning)) map.set(w.warning, { warning: w.warning, label: w.label, priority: w.priority, rows: [] });
      map.get(w.warning)!.rows.push(w);
    }
    return [...map.values()].sort((a, b) => a.priority - b.priority);
  }, [warnings]);

  if (warnings.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <CardTitle>Kræver handling</CardTitle>
            <span className="text-sm text-muted-foreground">{inspectorCount} synskonsulenter</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} aria-label={open ? "Skjul" : "Vis"}>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-5">
          {sections.map((s) => {
            const showAll = expanded[s.warning];
            const rows = showAll ? s.rows : s.rows.slice(0, 5);
            return (
              <div key={s.warning} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{s.label}</h3>
                  <Badge variant="secondary" className="text-xs">{s.rows.length}</Badge>
                </div>
                <div className="divide-y rounded-md border">
                  {rows.map((w) => (
                    <div key={`${w.warning}-${w.inspector_id}`} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <span className="font-medium">{w.full_name}</span>
                        {w.department && <span className="ml-2 text-sm text-muted-foreground">{w.department}</span>}
                        {(w.available_days_ahead ?? 0) > 0 && (
                          <span className="ml-2 text-xs text-muted-foreground">{w.available_days_ahead} ledige dage forude</span>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {w.warning === "inactive_in_planner" ? (
                          <>
                            <Button size="sm" variant="outline" onClick={() => onActivate(w)}>Aktivér</Button>
                            <Button size="sm" variant="ghost" onClick={() => onIgnore(w)}>Ignorer</Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => onFix(w)}>Ret</Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {s.rows.length > 5 && (
                  <Button
                    variant="link"
                    size="sm"
                    className="px-0"
                    onClick={() => setExpanded((e) => ({ ...e, [s.warning]: !e[s.warning] }))}
                  >
                    {showAll ? "Vis færre" : `Vis alle (${s.rows.length})`}
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
