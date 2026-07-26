import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pencil, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/noxl/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import {
  getMyRole,
  listInstallers,
  addInstaller,
  removeInstaller,
  updateUserRole,
} from "@/lib/noxl.functions";

export const Route = createFileRoute("/_authenticated/beheer/installateurs/")({
  head: () => ({
    meta: [
      { title: "Installateurs — NoXL" },
      { name: "description", content: "Beheer installateursaccounts, rollen en offerte-statistieken." },
    ],
  }),
  component: InstallersPage,
});

type AppRole = "admin" | "installer" | "customer";

function InstallersPage() {
  const qc = useQueryClient();
  const fetchRole = useServerFn(getMyRole);
  const fetchList = useServerFn(listInstallers);
  const doAdd = useServerFn(addInstaller);
  const doRemove = useServerFn(removeInstaller);
  const doUpdateRole = useServerFn(updateUserRole);

  const role = useQuery({ queryKey: ["my-role"], queryFn: () => fetchRole() });
  const list = useQuery({
    queryKey: ["installers"],
    queryFn: () => fetchList(),
    enabled: role.data?.role === "admin",
  });

  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");

  const [roleOpen, setRoleOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<{ id: string; email: string; current: AppRole } | null>(null);

  const addMut = useMutation({
    mutationFn: (email: string) => doAdd({ data: { email } }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success("Installateur toegevoegd");
        setAddOpen(false);
        setAddEmail("");
        qc.invalidateQueries({ queryKey: ["installers"] });
      } else {
        toast.error(res.message);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (user_id: string) => doRemove({ data: { user_id } }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success("Installateur verwijderd");
        qc.invalidateQueries({ queryKey: ["installers"] });
      } else {
        toast.error(res.message);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleMut = useMutation({
    mutationFn: (v: { user_id: string; role: AppRole }) => doUpdateRole({ data: v }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success("Rol bijgewerkt");
        setRoleOpen(false);
        setRoleTarget(null);
        qc.invalidateQueries({ queryKey: ["installers"] });
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
        <p>Alleen beheerders hebben toegang tot deze pagina.</p>
      </div>
    );
  }

  const installers = list.data?.installers ?? [];

  return (
    <AppShell role="admin" title="Installateurs">
      <Toaster position="top-right" richColors />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Installateurs</CardTitle>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Installateur toevoegen
          </Button>
        </CardHeader>
        <CardContent>
          {list.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Naam</TableHead>
                      <TableHead>Rollen</TableHead>
                      <TableHead>Laatste login</TableHead>
                      <TableHead className="text-right">Gegenereerd</TableHead>
                      <TableHead className="text-right">Verstuurd</TableHead>
                      <TableHead className="text-right">Acties</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {installers.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          <Link
                            to="/beheer/installateurs/$id"
                            params={{ id: u.id }}
                            className="hover:underline inline-flex items-center gap-1"
                          >
                            {u.email || "—"}
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </Link>
                        </TableCell>
                        <TableCell>{u.name ?? u.company ?? "—"}</TableCell>
                        <TableCell className="space-x-1">
                          {u.roles.length === 0 ? (
                            <Badge variant="outline">Geen</Badge>
                          ) : (
                            u.roles.map((r) => (
                              <Badge
                                key={r}
                                variant={r === "admin" ? "default" : r === "installer" ? "secondary" : "outline"}
                              >
                                {r}
                              </Badge>
                            ))
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("nl-BE") : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{u.generated}</TableCell>
                        <TableCell className="text-right tabular-nums">{u.sent}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const current: AppRole = u.roles.includes("admin")
                                ? "admin"
                                : u.roles.includes("installer")
                                  ? "installer"
                                  : "customer";
                              setRoleTarget({ id: u.id, email: u.email, current });
                              setRoleOpen(true);
                            }}
                          >
                            <Pencil className="mr-1 h-3 w-3" /> Rol wijzigen
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={removeMut.isPending}
                            onClick={() => {
                              if (confirm(`Installateur ${u.email} verwijderen?`)) {
                                removeMut.mutate(u.id);
                              }
                            }}
                          >
                            <Trash2 className="mr-1 h-3 w-3" /> Verwijderen
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {installers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Geen installateurs gevonden
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-3 md:hidden">
                {installers.map((u) => (
                  <div key={u.id} className="rounded-lg border bg-card p-4 shadow-sm">
                    <Link
                      to="/beheer/installateurs/$id"
                      params={{ id: u.id }}
                      className="font-semibold truncate block hover:underline"
                    >
                      {u.email || "—"}
                    </Link>
                    <div className="text-sm text-muted-foreground">{u.name ?? u.company ?? "—"}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <Badge key={r} variant={r === "admin" ? "default" : r === "installer" ? "secondary" : "outline"}>
                          {r}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-muted-foreground">Gegenereerd</div>
                        <div className="tabular-nums font-medium">{u.generated}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Verstuurd</div>
                        <div className="tabular-nums font-medium">{u.sent}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-11"
                        onClick={() => {
                          const current: AppRole = u.roles.includes("admin")
                            ? "admin"
                            : u.roles.includes("installer")
                              ? "installer"
                              : "customer";
                          setRoleTarget({ id: u.id, email: u.email, current });
                          setRoleOpen(true);
                        }}
                      >
                        <Pencil className="mr-1 h-3 w-3" /> Rol wijzigen
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="min-h-11"
                        disabled={removeMut.isPending}
                        onClick={() => {
                          if (confirm(`Installateur ${u.email} verwijderen?`)) removeMut.mutate(u.id);
                        }}
                      >
                        <Trash2 className="mr-1 h-3 w-3" /> Verwijderen
                      </Button>
                    </div>
                  </div>
                ))}
                {installers.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">Geen installateurs gevonden</div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add installer modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Installateur toevoegen</DialogTitle>
            <DialogDescription>
              Voeg de rol "installer" toe aan een bestaande gebruiker via het e-mailadres.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addMut.mutate(addEmail.trim());
            }}
            className="grid gap-3"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="email">E-mailadres</Label>
              <Input
                id="email"
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
                Annuleren
              </Button>
              <Button type="submit" disabled={addMut.isPending}>
                {addMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Toevoegen
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change role modal */}
      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rol wijzigen</DialogTitle>
            <DialogDescription>
              {roleTarget?.email ? `Kies een nieuwe rol voor ${roleTarget.email}.` : ""}
            </DialogDescription>
          </DialogHeader>
          {roleTarget && (
            <RoleForm
              current={roleTarget.current}
              onCancel={() => setRoleOpen(false)}
              onSubmit={(newRole) =>
                roleMut.mutate({ user_id: roleTarget.id, role: newRole })
              }
              busy={roleMut.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function RoleForm({
  current,
  onCancel,
  onSubmit,
  busy,
}: {
  current: AppRole;
  onCancel: () => void;
  onSubmit: (role: AppRole) => void;
  busy: boolean;
}) {
  const [value, setValue] = useState<AppRole>(current);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
      className="grid gap-3"
    >
      <div className="grid gap-1.5">
        <Label>Rol</Label>
        <Select value={value} onValueChange={(v) => setValue(v as AppRole)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">admin</SelectItem>
            <SelectItem value="installer">installer</SelectItem>
            <SelectItem value="customer">customer</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuleren
        </Button>
        <Button type="submit" disabled={busy || value === current}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Opslaan
        </Button>
      </DialogFooter>
    </form>
  );
}
