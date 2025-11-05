import { useState } from "react";
import { UserX, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ManageAvailabilityDrawer } from "@/components/availability/ManageAvailabilityDrawer";

export default function UnavailableConsultants() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <UserX className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Ikke tilgængelige synskonsulenter</h1>
          </div>
          <p className="text-muted-foreground mt-2">
            Administrer tilgængelighed for synskonsulenter der ikke er tilgængelige
          </p>
        </div>
        <Button onClick={() => setDrawerOpen(true)} size="lg" className="gap-2">
          <Plus className="h-5 w-5" />
          Tilføj synskonsulent for dato
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total ikke tilgængelige</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground mt-1">
              Vælg en dato for at se status
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Ingen data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground mt-1">
              Mangler tilgængelighedsdata
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Manuelt tilføjet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground mt-1">
              Overtrådte tilgængeligheder
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hvordan det virker</CardTitle>
          <CardDescription>
            Brug dette værktøj til at administrere tilgængelighed for synskonsulenter
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold">Trin 1: Vælg en dato</h3>
            <p className="text-sm text-muted-foreground">
              Klik på "Tilføj synskonsulent for dato" knappen for at åbne dialogen. Vælg den dato du vil administrere tilgængelighed for.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Trin 2: Filtrer og søg</h3>
            <p className="text-sm text-muted-foreground">
              Brug søgefeltet til at finde specifikke konsulenter. Du kan også filtrere efter kompetencer og tilgængelighedsstatus.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Trin 3: Gør tilgængelig</h3>
            <p className="text-sm text-muted-foreground">
              Klik på "Gør tilgængelig" knappen ved siden af en konsulent for at markere dem som tilgængelige for den valgte dato.
              Ændringen træder straks i kraft og konsulenten bliver bookbar til inspektioner.
            </p>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-4 mt-4">
            <p className="text-sm text-amber-900 dark:text-amber-200">
              <strong>Bemærk:</strong> Du kan ikke ændre tilgængelighed for tidligere datoer. Kun fremtidige datoer kan redigeres.
            </p>
          </div>
        </CardContent>
      </Card>

      <ManageAvailabilityDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSuccess={() => {
          // Could refresh stats here if we implement them
        }}
      />
    </div>
  );
}
