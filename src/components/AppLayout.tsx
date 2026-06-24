import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="h-screen flex w-full overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <main className="flex-1 overflow-auto min-w-0 min-h-0">{children}</main>
        </div>
        <SidebarTrigger
          className="fixed bottom-3 left-3 z-50 h-8 w-8 rounded-md border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-md hover:bg-sidebar-accent"
          aria-label="Toggle sidebar"
        />
      </div>
    </SidebarProvider>
  );
}
