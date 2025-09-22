import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shift, formatShiftTime, getRoleLabel } from "@/lib/shifts";
import { formatDateForDisplay } from "@/lib/date-utils";

interface ShiftDetailModalProps {
  shift: Shift | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShiftDetailModal({
  shift,
  open,
  onOpenChange,
}: ShiftDetailModalProps) {
  if (!shift) return null;

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return "N/A";
    try {
      return new Date(timestamp).toLocaleString("da-DK");
    } catch {
      return timestamp;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Vagtdetaljer</DialogTitle>
          <DialogDescription>
            Detaljeret visning af den valgte vagt
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Grundoplysninger</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Navn
                </label>
                <p className="text-sm">{shift.inspector_name}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Afdeling
                </label>
                <p className="text-sm">
                  <Badge variant="outline">{shift.department}</Badge>
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Synstype
                </label>
                <p className="text-sm">
                <Badge variant="secondary">
                  {getRoleLabel(shift.type || shift.wf_role_id)}
                </Badge>
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Status
                </label>
                <p className="text-sm">
                  <Badge 
                    variant={
                      shift.status === "Planlagt" ? "default" :
                      shift.status === "Flyttet" ? "secondary" : "destructive"
                    }
                  >
                    {shift.status || "Planlagt"}
                  </Badge>
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Location and Time */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Tid og sted</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Type/Role
                </label>
                <p className="text-sm">{shift.type || shift.wf_role_id || "Ikke angivet"}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Dato (lokal)
                </label>
                <p className="text-sm">{formatDateForDisplay(shift.date_local)}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Tidspunkt (lokal)
                </label>
                <p className="text-sm">
                  {formatShiftTime(shift.start_utc, shift.end_utc)}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Oprettet
                </label>
                <p className="text-sm">{formatTimestamp(shift.created_at)}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Technical Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Tekniske detaljer</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Workfeed Vagt ID
                </label>
                <p className="text-sm font-mono text-xs">{shift.wf_shift_id}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Workfeed Rolle ID
                </label>
                <p className="text-sm font-mono text-xs">{shift.wf_role_id}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Start UTC
                </label>
                <p className="text-sm font-mono text-xs">
                  {shift.start_utc || "N/A"}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Slut UTC
                </label>
                <p className="text-sm font-mono text-xs">
                  {shift.end_utc || "N/A"}
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Supabase ID
                </label>
                <p className="text-sm font-mono text-xs">{shift.id}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Raw JSON for debugging */}
          <details className="space-y-2">
            <summary className="text-sm font-medium cursor-pointer hover:text-primary">
              Raw JSON Data (til debugging)
            </summary>
            <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
              {JSON.stringify(shift, null, 2)}
            </pre>
          </details>
        </div>
      </DialogContent>
    </Dialog>
  );
}