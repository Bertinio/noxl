import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/noxl/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { getCustomer, createProject } from "@/lib/noxl.functions";

export const Route = createFileRoute("/_authenticated/customers/$id")({
  head: () => ({ meta: [{ title: "Klantdetail — NoXL" }] }),
  component: CustomerDetail,
});

const currency = new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" });

function CustomerDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchCustomer = useServerFn(getCustomer);
  const doCreateProject = useServerFn(createProject);

  const { data, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => fetchCustomer({ data: { id } }),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "" });

  const createMut = useMutation({
    mutationFn: () => doCreateProject({ data: { customer_id: id, title: form.title, description: form.description || null } }),
    onSuccess: (r) => {
      toast.success("Project aangemaakt");
      setOpen(false);
      setForm({ title: "", description: "" });
      qc.invalidateQueries({ queryKey: ["customer", id] });
      navigate({ to: "/projects/$id", params: { id: r.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!data) return null;

  return (
    <AppShell title="Klantdetail">
      <Toaster position="top-right" richColors />
      <div className="mb-4"><Button variant="ghost" size="sm" asChild><Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> Terug</Link></Button></div>
      <div className="grid gap-6">
        <Card>
          <CardHeader><CardTitle>{data.customer.name}</CardTitle></CardHeader>
          <CardContent className="grid gap-1 text-sm">
            <div><span className="text-muted-foreground">E-mail:</span> {data.customer.email}</div>
            {data.customer.company && <div><span className="text-muted-foreground">Bedrijf:</span> {data.customer.company}</div>}
            {data.customer.address && <div><span className="text-muted-foreground">Adres:</span> {data.customer.address}</div>}
            <div><span className="text-muted-foreground">Portaal:</span> {data.customer.auth_user_id ? "Actief" : "Nog niet uitgenodigd"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Projecten</CardTitle>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nieuw project voor deze klant</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nieuw project</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div className="grid gap-1.5"><Label>Titel</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                  <div className="grid gap-1.5"><Label>Beschrijving</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
                </div>
                <DialogFooter>
                  <Button variant="secondary" onClick={() => setOpen(false)}>Annuleren</Button>
                  <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.title}>{createMut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Aanmaken</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Titel</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Totaal</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.projects.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate({ to: "/projects/$id", params: { id: p.id } })}>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                    <TableCell className="text-right">{currency.format(Number(p.total_price ?? 0))}</TableCell>
                  </TableRow>
                ))}
                {data.projects.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Nog geen projecten</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
