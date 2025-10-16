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
      <div className="flex items-center gap-4 mb-8">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <CalendarCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="page-title">Planlagte Syn</h1>
          <p className="text-caption mt-1">
            Godkendte og planlagte syn
          </p>
        </div>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center justify-between text-lg">
            <span>Planlagte syn</span>
            <span className="text-sm font-normal text-muted-foreground">
              {assignments.length} planlagte
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <ScheduledTable assignments={assignments} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}