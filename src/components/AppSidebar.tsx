import {
  CalendarCheck,
  ClipboardList,
  Users,
  UserX,
  Shield,
  User,
  Brain,
  CalendarPlus,
  List,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const navigationItems = [
  {
    title: "Planlæg syn (Automatisk)",
    url: "/inspections",
    icon: ClipboardList,
    adminOnly: true,
  },
  {
    title: "Planlæg syn (Manuelt)",
    url: "/planlaeg-syn",
    icon: CalendarPlus,
    adminOnly: true,
  },
  {
    title: "Alle syn",
    url: "/alle-syn",
    icon: List,
    adminOnly: true,
  },
  {
    title: "Tilgængelige synskonsulenter",
    url: "/availability",
    icon: Users,
  },
  {
    title: "Tilføj tilgængelige SK",
    url: "/unavailable-consultants",
    icon: UserX,
    adminOnly: true,
  },
  {
    title: "Synskonsulenter",
    url: "/inspectors",
    icon: Shield,
  },
  {
    title: "ProfSyn AI",
    url: "/profsyn-ai",
    icon: Brain,
    hidden: true,
  },
  {
    title: "Planlagte syn",
    url: "/scheduled",
    icon: CalendarCheck,
    adminOnly: true,
    hidden: true,
  },
];

const adminNavigationItems = [
  {
    title: "Min konto",
    url: "/admin/account",
    icon: User,
  },
  {
    title: "Brugere",
    url: "/admin/users",
    icon: Users,
    adminOnly: true,
  },
];

export function AppSidebar() {
  const { hasRole } = useAuth();
  const location = useLocation();
  const isOnAdminRoute = location.pathname.startsWith("/admin");
  const [adminOpen, setAdminOpen] = useState(isOnAdminRoute);

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            PS
          </div>
          <span className="font-semibold text-sidebar-foreground">ProfSyn</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                if (item.hidden) return null;
                if (item.adminOnly && !hasRole("admin")) return null;

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className={({ isActive }) =>
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Section - Collapsible */}
        {hasRole("admin") && (
          <SidebarGroup>
            <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
              <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-1.5 text-xs font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors cursor-pointer">
                <span className="uppercase tracking-wider">Admin</span>
                {adminOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {adminNavigationItems.map((item) => {
                      if (item.adminOnly && !hasRole("admin")) return null;

                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild>
                            <NavLink
                              to={item.url}
                              className={({ isActive }) =>
                                isActive
                                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                              }
                            >
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
