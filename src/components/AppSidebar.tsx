import {
  CalendarCheck,
  Users,
  UserX,
  Shield,
  User,
  Brain,
  CalendarPlus,
  List,
  ChevronDown,
  ChevronRight,
  Clock,
  LogOut,
  Activity,
} from "lucide-react";
import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSystemStatus } from "@/hooks/useSystemStatus";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useInspectorWarnings } from "@/hooks/useInspectorWarnings";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const navigationItems = [
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
  {
    title: "Systemstatus",
    url: "/systemstatus",
    icon: Activity,
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
  {
    title: "Syn variabler",
    url: "/admin/syn-variabler",
    icon: Clock,
    adminOnly: true,
  },
];

export function AppSidebar() {
  const { hasRole, profile, signOut } = useAuth();
  const location = useLocation();
  const { inspectorCount: warningCount } = useInspectorWarnings();
  const { worstStatus: systemStatus } = useSystemStatus();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const isOnAdminRoute = location.pathname.startsWith("/admin");
  const [adminOpen, setAdminOpen] = useState(isOnAdminRoute);

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background text-sm font-bold">
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
                        {item.url === "/inspectors" && warningCount > 0 ? (
                          <span className="relative inline-flex">
                            <item.icon className="h-4 w-4" />
                            {isCollapsed && (
                              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-500" title={`${warningCount} synskonsulenter kræver handling`} />
                            )}
                          </span>
                        ) : (
                          <item.icon className="h-4 w-4" />
                        )}
                        <span>{item.title}</span>
                        {item.url === "/inspectors" && warningCount > 0 && !isCollapsed && (
                          <span
                            className="ml-auto rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-background"
                            title={`${warningCount} synskonsulenter kræver handling`}
                          >
                            {warningCount}
                          </span>
                        )}
                        {item.url === "/systemstatus" && systemStatus !== "ok" && (
                          <span
                            className={`ml-auto h-2 w-2 shrink-0 rounded-full ${systemStatus === "error" ? "bg-red-500" : "bg-amber-500"}`}
                            title={systemStatus === "error" ? "Noget kræver opmærksomhed" : "Der er advarsler"}
                          />
                        )}
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
                              {(item as any).badge && (
                                <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{(item as any).badge}</span>
                              )}
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
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center justify-between gap-2 px-2 py-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                <Avatar>
                  <AvatarFallback className="bg-foreground text-background">
                    {getInitials(profile?.full_name || profile?.email || null)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{profile?.full_name || "Bruger"}</p>
                  <p className="text-xs leading-none text-muted-foreground">{profile?.email}</p>
                  {hasRole("admin") && <p className="text-xs leading-none text-primary font-medium mt-1">Admin</p>}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()}>
                <LogOut className="mr-2 h-4 w-4" />
                Log ud
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <SidebarTrigger />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
