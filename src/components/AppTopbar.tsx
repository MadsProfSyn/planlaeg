import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppTopbar() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Menu className="h-4 w-4" />
            <span className="sr-only">Toggle sidebar</span>
          </Button>
        </SidebarTrigger>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-foreground">Syn Planner</h1>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {/* Placeholder for future actions like user menu, notifications etc */}
      </div>
    </header>
  );
}