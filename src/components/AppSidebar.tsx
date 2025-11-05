import { CalendarCheck, ClipboardList, Users, UserX, Shield, LayoutDashboard, User, FileText, Brain } from "lucide-react";
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

const navigationItems = [
  {
    title: "Syn ikke planlagt",
    url: "/inspections",
    icon: ClipboardList,
    adminOnly: true,
  },
  {
    title: "Planlagte syn",
    url: "/scheduled", 
    icon: CalendarCheck,
    adminOnly: true,
  },
  {
    title: "Tilgængelige synskonsulenter",
    url: "/availability",
    icon: Users,
  },
  {
    title: "Tilføj synskonsulenter",
    url: "/unavailable-consultants",
    icon: UserX,
    adminOnly: true,
  },
  {
    title: "ProfSyn AI",
    url: "/profsyn-ai",
    icon: Brain,
  },
];

const adminNavigationItems = [
  {
    title: "Oversigt",
    url: "/admin/overview",
    icon: LayoutDashboard,
  },
  {
    title: "Min konto",
    url: "/admin/account",
    icon: User,
  },
  {
    title: "Mine syn",
    url: "/admin/my-syn",
    icon: FileText,
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
  const isOnAdminRoute = location.pathname.startsWith('/admin');
  
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
                if (item.adminOnly && !hasRole('admin')) return null;
                
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
        
        {/* Admin Section */}
        {hasRole('admin') && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavigationItems.map((item) => {
                  if (item.adminOnly && !hasRole('admin')) return null;
                  
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
        )}
      </SidebarContent>
    </Sidebar>
  );
}