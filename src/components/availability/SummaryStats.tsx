import { Card, CardContent } from "@/components/ui/card";

interface SummaryStatsProps {
  totalInspectors: number;
  noResponseCount: number;
  responseRate: number;
}

export function SummaryStats({ totalInspectors, noResponseCount, responseRate }: SummaryStatsProps) {
  return (
    <Card className="mb-6 bg-muted/30">
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-2xl font-bold text-foreground">
                {noResponseCount} ud af {totalInspectors}
              </p>
              <p className="text-sm text-muted-foreground">
                synskonsulenter har ikke angivet status
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-3xl font-bold text-primary">
              {responseRate.toFixed(0)}%
            </p>
            <p className="text-sm text-muted-foreground">har svaret</p>
          </div>
        </div>
        
        <div className="mt-4">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${responseRate}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
