import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <AppTopbar />
          <main className="flex-1 p-6" role="main">
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground"
            >
              Skip to main content
            </a>
            <div id="main-content">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}