import { Button } from "@/components/ui/button";
import { Building2, Calendar, Filter } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
      <div className="text-center space-y-8 max-w-3xl mx-auto px-4">
        <div className="flex items-center justify-center gap-3 mb-6">
          <Building2 className="h-12 w-12 text-primary" />
          <h1 className="text-4xl md:text-6xl font-bold text-foreground">
            Syn Planner
          </h1>
        </div>
        
        <p className="text-xl text-muted-foreground max-w-2xl">
          Intern platform til at optimal planlægning af syn.
          efficiently assigning them to part-time inspectors.
        </p>

        <div className="grid gap-6 md:grid-cols-3 mt-12">
          <div className="p-6 bg-card rounded-lg border shadow-sm">
            <Calendar className="h-8 w-8 text-primary mb-4" />
            <h3 className="font-semibold mb-2">Schedule Inspections</h3>
            <p className="text-sm text-muted-foreground">
              Manage unscheduled inspections with smart filtering and bulk selection
            </p>
          </div>
          
          <div className="p-6 bg-card rounded-lg border shadow-sm">
            <Filter className="h-8 w-8 text-primary mb-4" />
            <h3 className="font-semibold mb-2">Smart Filtering</h3>
            <p className="text-sm text-muted-foreground">
              Filter by department, date range, and inspection type for efficient workflow
            </p>
          </div>
          
          <div className="p-6 bg-card rounded-lg border shadow-sm">
            <Building2 className="h-8 w-8 text-primary mb-4" />
            <h3 className="font-semibold mb-2">Optimize Routes</h3>
            <p className="text-sm text-muted-foreground">
              Future VRP integration for optimized inspector assignments
            </p>
          </div>
        </div>

        <div className="pt-8">
          <Button size="lg" className="text-lg px-8 py-4" asChild>
            <Link to="/inspections">
              Se syn
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
