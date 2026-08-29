import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, ArrowLeft, FileText, Download } from "lucide-react";
import { AppShell } from "@/components/noxl/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";
import { getProject, generateQuote } from "@/lib/noxl.functions";

export const Route = createFileRoute("/_authenticated/projects/$id/quotes")({
  head: () => ({ meta: [{ title: "Offertes — NoXL" }] }),
  component: QuotesList,
});

const currency = new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" });

function QuotesList() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchProject = useServerFn(getProject);
  const doGenerate = useServerFn(generateQuote);

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
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!data) return null;

  return (
    <AppShell title="Offertes">
      <Toaster position="top-right" richColors />
      <div className="mb-4"><Button variant="ghost" size="sm" asChild><Link to="/projects/$id" params={{ id }}><ArrowLeft className="mr-1 h-4 w-4" /> Terug</Link></Button></div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Offertes voor {data.project.title}</CardTitle>
          <Button size="sm" onClick={() => generateMut.mutate()} disabled={generateMut.isPending || data.configurations.length === 0}>
            {generateMut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileText className="mr-1 h-4 w-4" />} Nieuwe offerte
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Nummer</TableHead><TableHead>Datum</TableHead><TableHead className="text-right">Totaal</TableHead><TableHead className="text-right">PDF</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.quotes.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-mono text-sm">{q.quote_number}</TableCell>
                  <TableCell>{new Date(q.created_at).toLocaleDateString("nl-BE")}</TableCell>
                  <TableCell className="text-right">{currency.format(Number(q.total_price ?? 0))}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="secondary" onClick={() => navigate({ to: "/quotes/$id/print", params: { id: q.id } })}>
                      <Download className="mr-1 h-4 w-4" /> Genereer PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {data.quotes.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nog geen offertes</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
