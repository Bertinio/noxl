import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Wrench, FileText, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/noxl/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { getProject, generateQuote, updateProjectVatRate } from "@/lib/noxl.functions";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  head: () => ({ meta: [{ title: "Project — NoXL" }] }),
  component: ProjectDetail,
});

const currency = new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" });

function ProjectDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchProject = useServerFn(getProject);
  const doGenerate = useServerFn(generateQuote);
  const doUpdateVat = useServerFn(updateProjectVatRate);


  const { data, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => fetchProject({ data: { id } }),
  });

  const generateMut = useMutation({
    mutationFn: () => doGenerate({ data: { project_id: id } }),
    onSuccess: (r) => {
      toast.success(`Offerte ${r.quote_number} aangemaakt`);
      if (r.emailSent) toast.success("Offerte verzonden naar klant");
      else if (r.emailError) toast.error(`E-mail niet verzonden: ${r.emailError}`);
      qc.invalidateQueries({ queryKey: ["project", id] });
      navigate({ to: "/projects/$id/quotes", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const vatMut = useMutation({
    mutationFn: (vat_rate: 6 | 21) => doUpdateVat({ data: { id, vat_rate } }),
    onSuccess: () => {
      toast.success("BTW-tarief bijgewerkt");
      qc.invalidateQueries({ queryKey: ["project", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!data) return null;
  const p = data.project;
  const customer = data.customer;

  return (
    <AppShell role="admin" title={p.title}>
      <Toaster position="top-right" richColors />
      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild><Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> Terug</Link></Button>
        {customer && <Button variant="ghost" size="sm" asChild><Link to="/customers/$id" params={{ id: customer.id }}>Klant: {customer.name}</Link></Button>}
      </div>
      <div className="grid gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{p.title}</CardTitle>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="outline">{p.status}</Badge>
                <span className="text-sm text-muted-foreground">Totaal: <strong>{currency.format(Number(p.total_price ?? 0))}</strong></span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button asChild><Link to="/project/$projectId/configurator" params={{ projectId: id }}><Wrench className="mr-1 h-4 w-4" /> Open configurator</Link></Button>
              <Button variant="secondary" onClick={() => generateMut.mutate()} disabled={generateMut.isPending || data.configurations.length === 0}>
                {generateMut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileText className="mr-1 h-4 w-4" />} Genereer offerte
              </Button>
            </div>
          </CardHeader>
          {p.description && <CardContent className="text-sm text-muted-foreground">{p.description}</CardContent>}
        </Card>

        <Card>
          <CardHeader><CardTitle>Configuratie</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Optie</TableHead><TableHead>Waarde</TableHead><TableHead className="text-right">Aantal</TableHead>
                <TableHead className="text-right">Prijs/stuk</TableHead><TableHead className="text-right">Totaal</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.configurations.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.option_name}</TableCell>
                    <TableCell>{c.option_value ?? "—"}</TableCell>
                    <TableCell className="text-right">{c.quantity}</TableCell>
                    <TableCell className="text-right">{currency.format(Number(c.unit_price))}</TableCell>
                    <TableCell className="text-right">{currency.format(Number(c.total_price ?? 0))}</TableCell>
                  </TableRow>
                ))}
                {data.configurations.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nog geen configuratie</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Offertes</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link to="/projects/$id/quotes" params={{ id }}>Bekijk alle <ExternalLink className="ml-1 h-3 w-3" /></Link></Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Nummer</TableHead><TableHead>Datum</TableHead><TableHead className="text-right">Totaal</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.quotes.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell><Link to="/quotes/$id/print" params={{ id: q.id }} className="text-primary hover:underline">{q.quote_number}</Link></TableCell>
                    <TableCell>{new Date(q.created_at).toLocaleDateString("nl-BE")}</TableCell>
                    <TableCell className="text-right">{currency.format(Number(q.total_price ?? 0))}</TableCell>
                  </TableRow>
                ))}
                {data.quotes.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Nog geen offertes</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
