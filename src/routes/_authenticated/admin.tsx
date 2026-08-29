import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/noxl/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMyRole, listAdminUsers, updateUserRole } from "@/lib/noxl.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Beheer — NoXL" },
      { name: "description", content: "Beheer gebruikers en hun rollen in NoXL." },
    ],
  }),
  component: AdminPanel,
});

type AppRole = "admin" | "installer";
const ALL_ROLES: AppRole[] = ["admin", "installer"];

function roleBadgeVariant(role: AppRole): "default" | "secondary" {
  return role === "admin" ? "default" : "secondary";
}

function primaryRole(roles: string[]): AppRole | null {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("installer")) return "installer";
  return null;
}

function AdminPanel() {
  const qc = useQueryClient();
  const fetchRole = useServerFn(getMyRole);
  const fetchUsers = useServerFn(listAdminUsers);
  const doUpdate = useServerFn(updateUserRole);

  const role = useQuery({ queryKey: ["my-role"], queryFn: () => fetchRole() });
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsers(),
    enabled: role.data?.role === "admin",
  });

  const updateMut = useMutation({
    mutationFn: (v: { user_id: string; role: AppRole }) => doUpdate({ data: v }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success("Rol bijgewerkt");
        qc.invalidateQueries({ queryKey: ["admin-users"] });
      } else {
        toast.error(res.message);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (role.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (role.data?.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <p className="mb-4">Alleen beheerders hebben toegang tot dit paneel.</p>
          <Link to="/dashboard" className="text-primary underline">Terug naar je dashboard</Link>
        </div>
      </div>
    );
  }

  const rows = users.data?.users ?? [];

  const RoleBadges = ({ roles }: { roles: string[] }) => (
    <div className="flex flex-wrap gap-1">
      {roles.length === 0 && <Badge variant="outline">Geen</Badge>}
      {roles.map((r) => (
        <Badge key={r} variant={roleBadgeVariant(r as AppRole)}>{r}</Badge>
      ))}
    </div>
  );

  const RoleSelect = ({ userId, roles }: { userId: string; roles: string[] }) => {
    const current = primaryRole(roles) ?? undefined;
    const busy = updateMut.isPending && updateMut.variables?.user_id === userId;
    return (
      <Select
        value={current}
        onValueChange={(v) => updateMut.mutate({ user_id: userId, role: v as AppRole })}
        disabled={busy}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Kies rol" />
        </SelectTrigger>
        <SelectContent>
          {ALL_ROLES.map((r) => (
            <SelectItem key={r} value={r}>{r}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  return (
    <AppShell title="Beheer">
      <Toaster position="top-right" richColors />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Beheerders en installateurs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Rollen</TableHead>
                      <TableHead>Laatst ingelogd</TableHead>
                      <TableHead className="text-right">Rol wijzigen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.email || "—"}</TableCell>
                        <TableCell><RoleBadges roles={u.roles} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("nl-BE") : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end">
                            <RoleSelect userId={u.id} roles={u.roles} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Geen gebruikers gevonden
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile */}
              <div className="grid gap-3 sm:hidden">
                {rows.map((u) => (
                  <div key={u.id} className="rounded-lg border bg-card p-4 shadow-sm">
                    <div className="font-semibold truncate">{u.email || "—"}</div>
                    <div className="mt-2"><RoleBadges roles={u.roles} /></div>
                    <div className="mt-3">
                      <RoleSelect userId={u.id} roles={u.roles} />
                    </div>
                  </div>
                ))}
                {rows.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">Geen gebruikers gevonden</div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
