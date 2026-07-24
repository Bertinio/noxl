import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, FolderKanban, LogOut, FileText, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
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
import type { ReactNode } from "react";

type NavItem = { title: string; url: string; icon: React.ComponentType<{ className?: string }> };

const adminNav: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Klanten", url: "/dashboard", icon: Users },
];

const portalNav: NavItem[] = [
  { title: "Mijn projecten", url: "/portal", icon: FolderKanban },
];

export function AppShell({ role, children, title }: { role: "admin" | "customer"; children: ReactNode; title?: string }) {
  const nav = role === "admin" ? adminNav : portalNav;
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
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
              <SidebarGroupLabel>{role === "admin" ? "Beheer" : "Portaal"}</SidebarGroupLabel>
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
          <header className="h-14 flex items-center gap-3 border-b bg-background px-4">
            <SidebarTrigger />
            {title ? <h1 className="text-base font-semibold">{title}</h1> : null}
          </header>
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export { FileText, Home };
