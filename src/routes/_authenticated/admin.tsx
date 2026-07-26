import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldOff, UserPlus } from "lucide-react";
import { AppShell } from "@/components/noxl/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import {
  getMyRole,
  listAdminUsers,
  addUserRole,
  removeUserRole,
} from "@/lib/noxl.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Beheer — NoXL" },
      { name: "description", content: "Beheer gebruikers en hun rollen in NoXL." },
    ],
  }),
  component: AdminPanel,
});

type AppRole = "admin" | "customer";

function AdminPanel() {
  const qc = useQueryClient();
  const fetchRole = useServerFn(getMyRole);
  const fetchUsers = useServerFn(listAdminUsers);
  const doAdd = useServerFn(addUserRole);
  const doRemove = useServerFn(removeUserRole);

  const role = useQuery({ queryKey: ["my-role"], queryFn: () => fetchRole() });
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsers(),
    enabled: role.data?.role === "admin",
  });

  const addMut = useMutation({
    mutationFn: (v: { user_id: string; role: AppRole }) => doAdd({ data: v }),
    onSuccess: () => {
      toast.success("Rol toegevoegd");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (v: { user_id: string; role: AppRole }) => doRemove({ data: v }),
    onSuccess: () => {
      toast.success("Rol verwijderd");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
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
          <Link to="/portal" className="text-primary underline">Ga naar het klantportaal</Link>
        </div>
      </div>
    );
  }

  return (
    <AppShell role="admin" title="Beheer">
      <Toaster position="top-right" richColors />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Gebruikers en rollen
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
                      <TableHead className="text-right">Acties</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(users.data?.users ?? []).map((u) => {
                      const isAdmin = u.roles.includes("admin");
                      const isCustomer = u.roles.includes("customer");
                      const busy = addMut.isPending || removeMut.isPending;
                      return (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.email || "—"}</TableCell>
                          <TableCell className="space-x-1">
                            {u.roles.length === 0 && <Badge variant="outline">Geen</Badge>}
                            {isAdmin && <Badge>admin</Badge>}
                            {isCustomer && <Badge variant="secondary">customer</Badge>}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("nl-BE") : "—"}
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            {isAdmin ? (
                              <Button size="sm" variant="outline" disabled={busy}
                                onClick={() => removeMut.mutate({ user_id: u.id, role: "admin" })}>
                                <ShieldOff className="mr-1 h-3 w-3" /> Admin intrekken
                              </Button>
                            ) : (
                              <Button size="sm" disabled={busy}
                                onClick={() => addMut.mutate({ user_id: u.id, role: "admin" })}>
                                <ShieldCheck className="mr-1 h-3 w-3" /> Maak admin
                              </Button>
                            )}
                            {!isCustomer && (
                              <Button size="sm" variant="ghost" disabled={busy}
                                onClick={() => addMut.mutate({ user_id: u.id, role: "customer" })}>
                                <UserPlus className="mr-1 h-3 w-3" /> Customer-rol
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {(users.data?.users ?? []).length === 0 && (
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
                {(users.data?.users ?? []).map((u) => {
                  const isAdmin = u.roles.includes("admin");
                  const isCustomer = u.roles.includes("customer");
                  const busy = addMut.isPending || removeMut.isPending;
                  return (
                    <div key={u.id} className="rounded-lg border bg-card p-4 shadow-sm">
                      <div className="font-semibold truncate">{u.email || "—"}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {u.roles.length === 0 && <Badge variant="outline">Geen</Badge>}
                        {isAdmin && <Badge>admin</Badge>}
                        {isCustomer && <Badge variant="secondary">customer</Badge>}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {isAdmin ? (
                          <Button size="sm" variant="outline" className="min-h-11" disabled={busy}
                            onClick={() => removeMut.mutate({ user_id: u.id, role: "admin" })}>
                            <ShieldOff className="mr-1 h-3 w-3" /> Admin intrekken
                          </Button>
                        ) : (
                          <Button size="sm" className="min-h-11" disabled={busy}
                            onClick={() => addMut.mutate({ user_id: u.id, role: "admin" })}>
                            <ShieldCheck className="mr-1 h-3 w-3" /> Maak admin
                          </Button>
                        )}
                        {!isCustomer && (
                          <Button size="sm" variant="ghost" className="min-h-11" disabled={busy}
                            onClick={() => addMut.mutate({ user_id: u.id, role: "customer" })}>
                            <UserPlus className="mr-1 h-3 w-3" /> Customer-rol
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(users.data?.users ?? []).length === 0 && (
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
