import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, LogOut, FileText, Home, Package, ShieldCheck, Settings, Ruler } from "lucide-react";
import { signOutEverywhere } from "@/lib/auth-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyRole } from "@/lib/noxl.functions";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ComponentType, ReactNode } from "react";

type NavItem = { title: string; url: string; icon: ComponentType<{ className?: string }> };

const installerNav: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Klanten", url: "/dashboard", icon: Users },
  { title: "Producten", url: "/products", icon: Package },
  { title: "Instellingen", url: "/instellingen", icon: Settings },
];

const adminExtraNav: NavItem[] = [
  { title: "Installateurs", url: "/beheer/installateurs", icon: Users },
  { title: "Eenheden", url: "/beheer/eenheden", icon: Ruler },
  { title: "Beheer", url: "/admin", icon: ShieldCheck },
];

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchRole = useServerFn(getMyRole);
  const roleQuery = useQuery({
    queryKey: ["my-role"],
    queryFn: () => fetchRole(),
  });
  const isAdmin = roleQuery.data?.role === "admin";
  const nav = [...installerNav, ...(isAdmin ? adminExtraNav : [])];

  async function handleSignOut() {
    await signOutEverywhere(qc);
    navigate({ to: "/auth", replace: true });
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/20">
        <Sidebar collapsible="icon">
          <SidebarHeader className="px-3 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground font-bold">N</div>
              <span className="font-semibold">NoXL</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>{isAdmin ? "Beheer" : "Installateur"}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {nav.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={currentPath.startsWith(item.url)}>
                        <Link to={item.url} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="justify-start">
              <LogOut className="mr-2 h-4 w-4" /> Uitloggen
            </Button>
          </SidebarFooter>
        </Sidebar>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b bg-background px-4 sticky top-0 z-30">
            <SidebarTrigger className="min-h-11 min-w-11" />
            {title ? <h1 className="text-lg sm:text-base font-semibold truncate">{title}</h1> : null}
            {isAdmin ? (
              <Badge variant="secondary" className="ml-auto gap-1">
                <ShieldCheck className="h-3 w-3" /> Admin
              </Badge>
            ) : null}
          </header>
          <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export { FileText, Home };
