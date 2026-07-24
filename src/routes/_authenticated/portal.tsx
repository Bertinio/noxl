import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Download } from "lucide-react";
import { AppShell } from "@/components/noxl/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { myPortalData } from "@/lib/noxl.functions";

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({ meta: [{ title: "Mijn portaal — NoXL" }] }),
  component: Portal,
});

const currency = new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" });

function Portal() {
  const navigate = useNavigate();
  const fetchPortal = useServerFn(myPortalData);
  const { data, isLoading } = useQuery({ queryKey: ["portal"], queryFn: () => fetchPortal() });

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  if (!data?.customer) {
    return (
      <AppShell role="customer" title="Mijn portaal">
        <Card><CardContent className="p-8 text-center text-muted-foreground">Er is nog geen klantprofiel aan je account gekoppeld. Neem contact op met je installateur.</CardContent></Card>
      </AppShell>
    );
  }

  return (
    <AppShell role="customer" title={`Welkom, ${data.customer.name}`}>
      <div className="grid gap-6">
        <Card>
          <CardHeader><CardTitle>Mijn projecten</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Titel</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Totaal</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.projects.map((p) => (
                  <TableRow key={p.id}>
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

        <Card>
          <CardHeader><CardTitle>Mijn offertes</CardTitle></CardHeader>
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
                        <Download className="mr-1 h-4 w-4" /> Download
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {data.quotes.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nog geen offertes</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
