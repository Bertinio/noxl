import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { AppShell } from "@/components/noxl/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import {
  listCustomers,
  listProjects,
  createCustomer,
  createProject,
  getMyRole,
} from "@/lib/noxl.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — NoXL" },
      { name: "description", content: "Beheer klanten, projecten en offertes in NoXL." },
    ],
  }),
  component: Dashboard,
});

const currency = new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" });

function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchRole = useServerFn(getMyRole);
  const fetchCustomers = useServerFn(listCustomers);
  const fetchProjects = useServerFn(listProjects);
  const doCreateCustomer = useServerFn(createCustomer);
  const doCreateProject = useServerFn(createProject);

  const role = useQuery({ queryKey: ["my-role"], queryFn: () => fetchRole() });
  const customers = useQuery({ queryKey: ["customers"], queryFn: () => fetchCustomers() });
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fetchProjects() });

  const [custOpen, setCustOpen] = useState(false);
  const [projOpen, setProjOpen] = useState(false);
  const [custForm, setCustForm] = useState({ name: "", email: "", company: "", address: "", invite: true });
  const [projForm, setProjForm] = useState({ customer_id: "", title: "", description: "" });

  const createCustMut = useMutation({
    mutationFn: async () =>
      doCreateCustomer({
        data: {
          name: custForm.name,
          email: custForm.email,
          company: custForm.company || null,
          address: custForm.address || null,
          invite: custForm.invite,
        },
      }),
    onSuccess: () => {
      toast.success("Klant aangemaakt");
      setCustOpen(false);
      setCustForm({ name: "", email: "", company: "", address: "", invite: true });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createProjMut = useMutation({
    mutationFn: async () =>
      doCreateProject({
        data: {
          customer_id: projForm.customer_id,
          title: projForm.title,
          description: projForm.description || null,
        },
      }),
    onSuccess: (r) => {
      toast.success("Project aangemaakt");
      setProjOpen(false);
      setProjForm({ customer_id: "", title: "", description: "" });
      qc.invalidateQueries({ queryKey: ["projects"] });
      navigate({ to: "/projects/$id", params: { id: r.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (role.isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (role.data?.role === "customer") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <p className="mb-4">Geen toegang tot het beheerdashboard.</p>
          <Link to="/portal" className="text-primary underline">Ga naar het klantportaal</Link>
        </div>
      </div>
    );
  }

  return (
    <AppShell role="admin" title="Dashboard">
      <Toaster position="top-right" richColors />
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 space-y-0">
            <CardTitle className="text-xl sm:text-lg">Klanten</CardTitle>
            <Dialog open={custOpen} onOpenChange={setCustOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="min-h-11 shrink-0"><Plus className="mr-1 h-4 w-4" /> <span className="hidden xs:inline sm:inline">Nieuwe klant</span><span className="xs:hidden sm:hidden">Klant</span></Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nieuwe klant</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div className="grid gap-1.5"><Label>Naam</Label><Input value={custForm.name} onChange={(e) => setCustForm({ ...custForm, name: e.target.value })} /></div>
                  <div className="grid gap-1.5"><Label>E-mail</Label><Input type="email" value={custForm.email} onChange={(e) => setCustForm({ ...custForm, email: e.target.value })} /></div>
                  <div className="grid gap-1.5"><Label>Bedrijf</Label><Input value={custForm.company} onChange={(e) => setCustForm({ ...custForm, company: e.target.value })} /></div>
                  <div className="grid gap-1.5"><Label>Adres</Label><Input value={custForm.address} onChange={(e) => setCustForm({ ...custForm, address: e.target.value })} /></div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={custForm.invite} onChange={(e) => setCustForm({ ...custForm, invite: e.target.checked })} />
                    Nodig klant uit voor portaal (magic link)
                  </label>
                </div>
                <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                  <Button variant="secondary" onClick={() => setCustOpen(false)} className="min-h-11 w-full sm:w-auto">Annuleren</Button>
                  <Button onClick={() => createCustMut.mutate()} disabled={createCustMut.isPending || !custForm.name || !custForm.email} className="min-h-11 w-full sm:w-auto">
                    {createCustMut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Opslaan
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {/* Desktop table */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Naam</TableHead><TableHead>Bedrijf</TableHead><TableHead>E-mail</TableHead><TableHead>Portaal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(customers.data ?? []).map((c) => (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate({ to: "/customers/$id", params: { id: c.id } })}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.company ?? "—"}</TableCell>
                      <TableCell>{c.email}</TableCell>
                      <TableCell>{c.auth_user_id ? <Badge>Actief</Badge> : <Badge variant="outline">Geen</Badge>}</TableCell>
                    </TableRow>
                  ))}
                  {(customers.data ?? []).length === 0 && !customers.isLoading && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nog geen klanten</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {/* Mobile stacked cards */}
            <div className="grid gap-3 sm:hidden">
              {(customers.data ?? []).map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate({ to: "/customers/$id", params: { id: c.id } })}
                  className="rounded-lg border bg-card p-4 text-left shadow-sm active:bg-muted/50"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className="font-semibold text-base">{c.name}</span>
                    {c.auth_user_id ? <Badge>Actief</Badge> : <Badge variant="outline">Geen portaal</Badge>}
                  </div>
                  <dl className="grid gap-1.5 text-sm">
                    <div className="grid grid-cols-[80px_1fr] gap-2">
                      <dt className="text-muted-foreground">Bedrijf</dt>
                      <dd>{c.company ?? "—"}</dd>
                    </div>
                    <div className="grid grid-cols-[80px_1fr] gap-2">
                      <dt className="text-muted-foreground">E-mail</dt>
                      <dd className="truncate">{c.email}</dd>
                    </div>
                  </dl>
                </button>
              ))}
              {(customers.data ?? []).length === 0 && !customers.isLoading && (
                <div className="text-center text-muted-foreground py-8">Nog geen klanten</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 space-y-0">
            <CardTitle className="text-xl sm:text-lg">Projecten</CardTitle>
            <Dialog open={projOpen} onOpenChange={setProjOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={(customers.data ?? []).length === 0} className="min-h-11 shrink-0"><Plus className="mr-1 h-4 w-4" /> <span className="hidden xs:inline sm:inline">Nieuw project</span><span className="xs:hidden sm:hidden">Project</span></Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nieuw project</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label>Klant</Label>
                    <select className="h-11 rounded-md border bg-background px-2 text-sm" value={projForm.customer_id} onChange={(e) => setProjForm({ ...projForm, customer_id: e.target.value })}>
                      <option value="">Kies een klant…</option>
                      {(customers.data ?? []).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ""}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-1.5"><Label>Titel</Label><Input value={projForm.title} onChange={(e) => setProjForm({ ...projForm, title: e.target.value })} /></div>
                  <div className="grid gap-1.5"><Label>Beschrijving</Label><Textarea value={projForm.description} onChange={(e) => setProjForm({ ...projForm, description: e.target.value })} rows={3} /></div>
                </div>
                <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                  <Button variant="secondary" onClick={() => setProjOpen(false)} className="min-h-11 w-full sm:w-auto">Annuleren</Button>
                  <Button onClick={() => createProjMut.mutate()} disabled={createProjMut.isPending || !projForm.customer_id || !projForm.title} className="min-h-11 w-full sm:w-auto">
                    {createProjMut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Aanmaken
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {/* Desktop table */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titel</TableHead><TableHead>Klant</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Totaal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(projects.data ?? []).map((p) => (
                    <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate({ to: "/projects/$id", params: { id: p.id } })}>
                      <TableCell className="font-medium">{p.title}</TableCell>
                      <TableCell>{p.customer_name ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                      <TableCell className="text-right">{currency.format(Number(p.total_price ?? 0))}</TableCell>
                    </TableRow>
                  ))}
                  {(projects.data ?? []).length === 0 && !projects.isLoading && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nog geen projecten</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {/* Mobile project cards: status naast titel, totaal onder titel, klant verborgen */}
            <div className="grid gap-3 sm:hidden">
              {(projects.data ?? []).map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate({ to: "/projects/$id", params: { id: p.id } })}
                  className="rounded-lg border bg-card p-4 text-left shadow-sm active:bg-muted/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-base truncate">{p.title}</span>
                    <Badge variant="outline" className="shrink-0">{p.status}</Badge>
                  </div>
                  <div className="mt-1 text-lg font-bold text-primary">
                    {currency.format(Number(p.total_price ?? 0))}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground truncate">{p.customer_name ?? "—"}</div>
                </button>
              ))}
              {(projects.data ?? []).length === 0 && !projects.isLoading && (
                <div className="text-center text-muted-foreground py-8">Nog geen projecten</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
