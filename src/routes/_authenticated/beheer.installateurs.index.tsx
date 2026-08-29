import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ExternalLink, KeyRound, Copy } from "lucide-react";
import { AppShell } from "@/components/noxl/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  createInstaller,
  deleteInstaller,
  updateInstallerRole,
  toggleInstallerActive,
  resetInstallerPassword,
} from "@/lib/noxl.functions";

export const Route = createFileRoute("/_authenticated/beheer/installateurs/")({
  head: () => ({
    meta: [
      { title: "Installateurs — NoXL" },
      { name: "description", content: "Beheer installateursaccounts, rollen, status en offerte-statistieken." },
      { property: "og:title", content: "Installateurs — NoXL" },
      { property: "og:description", content: "Beheer installateursaccounts, rollen, status en offerte-statistieken." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InstallersPage,
});

type ManagedRole = "admin" | "installer";

const dateFmt = (v: string | null) => (v ? new Date(v).toLocaleDateString("nl-BE") : "—");

function InstallersPage() {
  const qc = useQueryClient();
  const fetchRole = useServerFn(getMyRole);
  const fetchList = useServerFn(listInstallers);
  const doCreate = useServerFn(createInstaller);
  const doDelete = useServerFn(deleteInstaller);
  const doUpdateRole = useServerFn(updateInstallerRole);
  const doToggle = useServerFn(toggleInstallerActive);
  const doReset = useServerFn(resetInstallerPassword);

  const role = useQuery({ queryKey: ["my-role"], queryFn: () => fetchRole() });
  const list = useQuery({
    queryKey: ["installers"],
    queryFn: () => fetchList(),
    enabled: role.data?.role === "admin",
  });

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", company: "" });
  const [resetLink, setResetLink] = useState<{ email: string; link: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; email: string } | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["installers"] });

  const createMut = useMutation({
    mutationFn: (v: { email: string; name: string | null; company: string | null }) =>
      doCreate({ data: v }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.message);
      toast.success(res.existed ? "Bestaande gebruiker kreeg de rol installateur" : "Installateur aangemaakt");
      setAddOpen(false);
      setForm({ email: "", name: "", company: "" });
      invalidate();
      if (res.reset_link) setResetLink({ email: "", link: res.reset_link });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (user_id: string) => doDelete({ data: { user_id } }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.message);
      toast.success("Installateur verwijderd");
      setConfirmDelete(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleMut = useMutation({
    mutationFn: (v: { user_id: string; role: ManagedRole }) => doUpdateRole({ data: v }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.message);
      toast.success(`Rol bijgewerkt naar ${res.role}`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: (v: { user_id: string; active: boolean }) => doToggle({ data: v }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.message);
      toast.success(res.active ? "Installateur geactiveerd" : "Installateur gedeactiveerd");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetMut = useMutation({
    mutationFn: (user_id: string) => doReset({ data: { user_id } }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.message);
      setResetLink({ email: res.email, link: res.link });
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

  const currentRole = (roles: string[]): ManagedRole => (roles.includes("admin") ? "admin" : "installer");

  const StatusBadge = ({ active }: { active: boolean }) =>
    active ? (
      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Active</Badge>
    ) : (
      <Badge variant="secondary" className="text-muted-foreground">Gedeactiveerd</Badge>
    );

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
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Naam</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Laatste login</TableHead>
                      <TableHead>Laatste offerte</TableHead>
                      <TableHead className="text-right">Gegen.</TableHead>
                      <TableHead className="text-right">Verst.</TableHead>
                      <TableHead className="text-right">Open</TableHead>
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
                        <TableCell>
                          <Select
                            value={currentRole(u.roles)}
                            onValueChange={(v) => roleMut.mutate({ user_id: u.id, role: v as ManagedRole })}
                          >
                            <SelectTrigger className="h-8 w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">admin</SelectItem>
                              <SelectItem value="installer">installer</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={u.active}
                              disabled={toggleMut.isPending}
                              onCheckedChange={(checked) =>
                                toggleMut.mutate({ user_id: u.id, active: checked })
                              }
                              aria-label="Activeer of deactiveer installateur"
                            />
                            <StatusBadge active={u.active} />
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{dateFmt(u.last_sign_in_at)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{dateFmt(u.last_quote_at)}</TableCell>
                        <TableCell className="text-right tabular-nums">{u.generated}</TableCell>
                        <TableCell className="text-right tabular-nums">{u.sent}</TableCell>
                        <TableCell className="text-right tabular-nums">{u.open}</TableCell>
                        <TableCell className="text-right space-x-2 whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={resetMut.isPending}
                            onClick={() => resetMut.mutate(u.id)}
                          >
                            <KeyRound className="mr-1 h-3 w-3" /> Reset wachtwoord
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setConfirmDelete({ id: u.id, email: u.email })}
                          >
                            <Trash2 className="mr-1 h-3 w-3" /> Verwijderen
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {installers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
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
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to="/beheer/installateurs/$id"
                        params={{ id: u.id }}
                        className="font-semibold truncate block hover:underline"
                      >
                        {u.email || "—"}
                      </Link>
                      <StatusBadge active={u.active} />
                    </div>
                    <div className="text-sm text-muted-foreground">{u.name ?? u.company ?? "—"}</div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-muted-foreground">Gegenereerd</div>
                        <div className="tabular-nums font-medium">{u.generated}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Verstuurd</div>
                        <div className="tabular-nums font-medium">{u.sent}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Open offertes</div>
                        <div className="tabular-nums font-medium">{u.open}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Laatste offerte</div>
                        <div className="font-medium">{dateFmt(u.last_quote_at)}</div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2">
                      <div className="grid gap-1.5">
                        <Label className="text-xs text-muted-foreground">Rol</Label>
                        <Select
                          value={currentRole(u.roles)}
                          onValueChange={(v) => roleMut.mutate({ user_id: u.id, role: v as ManagedRole })}
                        >
                          <SelectTrigger className="min-h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">admin</SelectItem>
                            <SelectItem value="installer">installer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between rounded-md border px-3 py-2">
                        <span className="text-sm">Actief</span>
                        <Switch
                          checked={u.active}
                          disabled={toggleMut.isPending}
                          onCheckedChange={(checked) => toggleMut.mutate({ user_id: u.id, active: checked })}
                          aria-label="Activeer of deactiveer installateur"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-11"
                          disabled={resetMut.isPending}
                          onClick={() => resetMut.mutate(u.id)}
                        >
                          <KeyRound className="mr-1 h-3 w-3" /> Reset wachtwoord
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="min-h-11"
                          onClick={() => setConfirmDelete({ id: u.id, email: u.email })}
                        >
                          <Trash2 className="mr-1 h-3 w-3" /> Verwijderen
                        </Button>
                      </div>
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
              Maakt een account aan met rol "installer" en status actief. Bestaat het e-mailadres al, dan
              krijgt die gebruiker de rol installateur.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMut.mutate({
                email: form.email.trim(),
                name: form.name.trim() || null,
                company: form.company.trim() || null,
              });
            }}
            className="grid gap-3"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="email">E-mailadres *</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                autoComplete="off"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="name">Naam</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoComplete="off"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="company">Bedrijf</Label>
              <Input
                id="company"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                autoComplete="off"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
                Annuleren
              </Button>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Toevoegen
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset link modal */}
      <Dialog open={resetLink !== null} onOpenChange={(o) => !o && setResetLink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset-link wachtwoord</DialogTitle>
            <DialogDescription>
              Deel deze link met de installateur{resetLink?.email ? ` (${resetLink.email})` : ""}. Er wordt
              geen e-mail verstuurd.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <textarea
              readOnly
              value={resetLink?.link ?? ""}
              rows={4}
              className="w-full rounded-md border bg-muted p-2 text-xs break-all"
            />
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                if (!resetLink) return;
                try {
                  await navigator.clipboard.writeText(resetLink.link);
                  toast.success("Link gekopieerd");
                } catch {
                  toast.error("Kopiëren mislukt — selecteer de link handmatig");
                }
              }}
            >
              <Copy className="mr-1 h-4 w-4" /> Kopieer link
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setResetLink(null)}>
              Sluiten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm modal */}
      <Dialog open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Installateur verwijderen</DialogTitle>
            <DialogDescription>
              {confirmDelete?.email} wordt definitief verwijderd: account, rollen en profiel. Deze actie kan
              niet ongedaan gemaakt worden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirmDelete(null)}>
              Annuleren
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMut.isPending}
              onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.id)}
            >
              {deleteMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Definitief verwijderen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
