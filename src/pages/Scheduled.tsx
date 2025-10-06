import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarCheck } from "lucide-react";
import { ScheduledTable } from "@/components/scheduled/ScheduledTable";
import { getProposedAssignments } from "@/lib/scheduled";
import { useToast } from "@/hooks/use-toast";

export default function ScheduledPage() {
  const { toast } = useToast();

  // Fetch proposed assignments
  const {
    data: assignments = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["proposed-assignments"],
    queryFn: () => getProposedAssignments({ status: "PROPOSED" }),
    staleTime: 30 * 1000, // 30 seconds
  });

  // Handle errors
  React.useEffect(() => {
    if (error) {
      toast({
        title: "Fejl ved indlæsning",
        description: "Kunne ikke hente planlagte syn. Prøv at genindlæse siden.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-3">
        <CalendarCheck className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Planlagte Syn</h1>
          <p className="text-muted-foreground">
            Godkendte og planlagte syn
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Planlagte syn</span>
            <span className="text-sm font-normal text-muted-foreground">
              {assignments.length} planlagte
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScheduledTable assignments={assignments} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}