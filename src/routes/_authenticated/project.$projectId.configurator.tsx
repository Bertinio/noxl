import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/noxl/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getProject, saveConfigurations, listProducts } from "@/lib/noxl.functions";

export const Route = createFileRoute("/_authenticated/project/$projectId/configurator")({
  head: () => ({ meta: [{ title: "Configurator — NoXL" }] }),
  component: Configurator,
});

const currency = new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" });

type Row = {
  product_id: string;
  option_name: string;
  option_value: string;
  quantity: number;
  unit_price: number;
};

function emptyRow(): Row {
  return { product_id: "", option_name: "", option_value: "", quantity: 1, unit_price: 0 };
}

export default function Configurator() {
  const { projectId } = Route.useParams();
  const fetchProject = useServerFn(getProject);
  const fetchProducts = useServerFn(listProducts);
  const doSave = useServerFn(saveConfigurations);

  const projectQ = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => fetchProject({ data: { id: projectId } }),
  });
  const productsQ = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });

  const [rows, setRows] = useState<Row[]>([]);
  const [newRow, setNewRow] = useState<Row>(emptyRow());

  useEffect(() => {
    if (projectQ.data) {
      setRows(
        projectQ.data.configurations
          .filter((c) => c.product_id)
          .map((c) => ({
            product_id: c.product_id as string,
            option_name: c.option_name,
            option_value: c.option_value ?? "",
            quantity: c.quantity,
            unit_price: Number(c.unit_price),
          })),
      );
    }
  }, [projectQ.data]);

  const grandTotal = rows.reduce((s, r) => s + r.quantity * r.unit_price, 0)
    + (newRow.product_id ? newRow.quantity * newRow.unit_price : 0);

  const saveMut = useMutation({
    mutationFn: (items: Row[]) =>
      doSave({
        data: {
          project_id: projectId,
          items: items.map((r) => ({
            product_id: r.product_id,
            option_name: r.option_name,
            option_value: r.option_value || null,
            quantity: r.quantity,
            unit_price: r.unit_price,
          })),
        },
      }),
    onSuccess: () => toast.success("Configuratie opgeslagen"),
    onError: (e: Error) => toast.error(e.message),
  });

  function pickProduct(productId: string) {
    const p = (productsQ.data ?? []).find((x) => x.id === productId);
    if (!p) return;
    setNewRow({
      product_id: p.id,
      option_name: p.name,
      option_value: p.description ?? "",
      quantity: newRow.quantity || 1,
      unit_price: Number(p.unit_price) || 0,
    });
  }

  function addRule() {
    if (!newRow.product_id) { toast.error("Kies een product"); return; }
    const next = [...rows, newRow];
    setRows(next);
    setNewRow(emptyRow());
    saveMut.mutate(next);
  }
  function removeRule(i: number) {
    const next = rows.filter((_, idx) => idx !== i);
    setRows(next);
    saveMut.mutate(next);
  }

  if (projectQ.isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!projectQ.data) return null;

  const products = productsQ.data ?? [];

  return (
    <AppShell role="admin" title="Configurator">
      <Toaster position="top-right" richColors />
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/projects/$id" params={{ id: projectId }}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Terug naar project
          </Link>
        </Button>
        <div className="text-sm">Live totaal: <strong>{currency.format(grandTotal)}</strong></div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader><CardTitle>Project: {projectQ.data.project.title}</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {projectQ.data.project.description ?? "Geen beschrijving"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Configuratieregels</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Beschrijving</TableHead>
                  <TableHead className="text-right">Aantal</TableHead>
                  <TableHead className="text-right">Prijs/stuk</TableHead>
                  <TableHead className="text-right">Totaal</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.option_name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.option_value || "—"}</TableCell>
                    <TableCell className="text-right">{r.quantity}</TableCell>
                    <TableCell className="text-right">{currency.format(r.unit_price)}</TableCell>
                    <TableCell className="text-right">{currency.format(r.quantity * r.unit_price)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => removeRule(i)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nog geen regels</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Nieuwe regel toevoegen</CardTitle></CardHeader>
          <CardContent>
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nog geen producten. Voeg eerst producten toe via <Link to="/products" className="underline">Producten</Link>.
              </p>
            ) : (
              <div className="grid grid-cols-[1.4fr_1.4fr_90px_120px_120px_auto] gap-2 items-end">
                <div className="grid gap-1.5">
                  <label className="text-xs text-muted-foreground">Product</label>
                  <Select value={newRow.product_id} onValueChange={pickProduct}>
                    <SelectTrigger><SelectValue placeholder="Kies een product" /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — {currency.format(Number(p.unit_price) || 0)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs text-muted-foreground">Beschrijving</label>
                  <Input value={newRow.option_value} onChange={(e) => setNewRow({ ...newRow, option_value: e.target.value })} placeholder="Optioneel" />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs text-muted-foreground">Aantal</label>
                  <Input type="number" min={0} value={newRow.quantity}
                    onChange={(e) => setNewRow({ ...newRow, quantity: Number(e.target.value) || 0 })}
                    className="text-right" />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs text-muted-foreground">Prijs/stuk</label>
                  <div className="h-9 flex items-center justify-end text-sm">{currency.format(newRow.unit_price)}</div>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs text-muted-foreground">Regeltotaal</label>
                  <div className="h-9 flex items-center justify-end text-sm font-medium">
                    {currency.format(newRow.quantity * newRow.unit_price)}
                  </div>
                </div>
                <Button onClick={addRule} disabled={saveMut.isPending || !newRow.product_id}>
                  {saveMut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
                  Toevoegen
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
