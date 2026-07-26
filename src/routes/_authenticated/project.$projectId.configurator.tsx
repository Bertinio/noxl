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
const num = new Intl.NumberFormat("nl-BE", { maximumFractionDigits: 3 });

type Row = {
  product_id: string;
  option_name: string;
  option_value: string;
  width_mm: number;
  height_mm: number;
  quantity: number;
  unit_price: number; // per m²
};

function emptyRow(): Row {
  return { product_id: "", option_name: "", option_value: "", width_mm: 0, height_mm: 0, quantity: 1, unit_price: 0 };
}

function area(r: Row) { return (r.width_mm * r.height_mm) / 1_000_000; }
function lineTotal(r: Row) { return area(r) * r.unit_price * r.quantity; }

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
            width_mm: Number(c.width_mm) || 0,
            height_mm: Number(c.height_mm) || 0,
            quantity: c.quantity,
            unit_price: Number(c.unit_price),
          })),
      );
    }
  }, [projectQ.data]);

  const grandTotal = rows.reduce((s, r) => s + lineTotal(r), 0)
    + (newRow.product_id ? lineTotal(newRow) : 0);

  const saveMut = useMutation({
    mutationFn: (items: Row[]) =>
      doSave({
        data: {
          project_id: projectId,
          items: items.map((r) => ({
            product_id: r.product_id,
            option_name: r.option_name,
            option_value: r.option_value || null,
            width_mm: r.width_mm,
            height_mm: r.height_mm,
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
      ...newRow,
      product_id: p.id,
      option_name: p.name,
      option_value: p.description ?? "",
      unit_price: Number(p.unit_price) || 0,
    });
  }

  function addRule() {
    if (!newRow.product_id) { toast.error("Kies een product"); return; }
    if (newRow.width_mm <= 0 || newRow.height_mm <= 0) { toast.error("Vul breedte en hoogte in"); return; }
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
      {/* Terug + desktop-totaal */}
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" asChild className="min-h-12 w-full justify-start sm:w-auto">
          <Link to="/projects/$id" params={{ id: projectId }}>
            <ArrowLeft className="mr-2 h-5 w-5" /> Terug naar project
          </Link>
        </Button>
        <div className="hidden text-sm sm:block">Live totaal: <strong>{currency.format(grandTotal)}</strong></div>
      </div>

      {/* Content — extra bottom padding op mobiel voor sticky bar */}
      <div className="grid gap-4 pb-24 sm:gap-6 sm:pb-0">
        <Card>
          <CardHeader><CardTitle className="text-xl sm:text-lg">Project: {projectQ.data.project.title}</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {projectQ.data.project.description ?? "Geen beschrijving"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-xl sm:text-lg">Configuratieregels</CardTitle></CardHeader>
          <CardContent className="p-3 sm:p-6">
            {/* Desktop tabel */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">B (mm)</TableHead>
                    <TableHead className="text-right">H (mm)</TableHead>
                    <TableHead className="text-right">m²</TableHead>
                    <TableHead className="text-right">Aantal</TableHead>
                    <TableHead className="text-right">Prijs/m²</TableHead>
                    <TableHead className="text-right">Totaal</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.option_name}</TableCell>
                      <TableCell className="text-right">{r.width_mm}</TableCell>
                      <TableCell className="text-right">{r.height_mm}</TableCell>
                      <TableCell className="text-right">{num.format(area(r))}</TableCell>
                      <TableCell className="text-right">{r.quantity}</TableCell>
                      <TableCell className="text-right">{currency.format(r.unit_price)}</TableCell>
                      <TableCell className="text-right">{currency.format(lineTotal(r))}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => removeRule(i)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nog geen regels</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobiele kaarten */}
            <div className="grid gap-3 sm:hidden">
              {rows.map((r, i) => (
                <div key={i} className="rounded-lg border bg-card p-4 shadow-sm">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <span className="font-semibold text-base truncate">{r.option_name}</span>
                    <Button variant="ghost" size="icon" className="min-h-11 min-w-11 shrink-0" onClick={() => removeRule(i)}>
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Breedte</dt>
                      <dd className="font-medium">{r.width_mm} mm</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Hoogte</dt>
                      <dd className="font-medium">{r.height_mm} mm</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Oppervlakte</dt>
                      <dd className="font-medium">{num.format(area(r))} m²</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Aantal</dt>
                      <dd className="font-medium">{r.quantity}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Prijs/m²</dt>
                      <dd className="font-medium">{currency.format(r.unit_price)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Totaal</dt>
                      <dd className="font-semibold text-primary">{currency.format(lineTotal(r))}</dd>
                    </div>
                  </dl>
                </div>
              ))}
              {rows.length === 0 && (
                <div className="text-center text-muted-foreground py-8">Nog geen regels</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-xl sm:text-lg">Nieuwe regel toevoegen</CardTitle></CardHeader>
          <CardContent>
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nog geen producten. Voeg eerst producten toe via <Link to="/products" className="underline">Producten</Link>.
              </p>
            ) : (
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <label className="text-sm text-muted-foreground">Product</label>
                  <Select value={newRow.product_id} onValueChange={pickProduct}>
                    <SelectTrigger className="min-h-11"><SelectValue placeholder="Kies een product" /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — {currency.format(Number(p.unit_price) || 0)}/m²
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_120px_120px_90px_auto] sm:items-end">
                  <div className="grid gap-1.5">
                    <label className="text-sm text-muted-foreground">Beschrijving</label>
                    <Input value={newRow.option_value} onChange={(e) => setNewRow({ ...newRow, option_value: e.target.value })} placeholder="Optioneel" className="min-h-11" />
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-sm text-muted-foreground">Breedte (mm)</label>
                    <Input type="number" min={0} value={newRow.width_mm || ""}
                      onChange={(e) => setNewRow({ ...newRow, width_mm: Number(e.target.value) || 0 })}
                      className="min-h-11 text-right" />
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-sm text-muted-foreground">Hoogte (mm)</label>
                    <Input type="number" min={0} value={newRow.height_mm || ""}
                      onChange={(e) => setNewRow({ ...newRow, height_mm: Number(e.target.value) || 0 })}
                      className="min-h-11 text-right" />
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-sm text-muted-foreground">Aantal</label>
                    <Input type="number" min={1} value={newRow.quantity}
                      onChange={(e) => setNewRow({ ...newRow, quantity: Number(e.target.value) || 0 })}
                      className="min-h-11 text-right" />
                  </div>
                  <Button onClick={addRule} disabled={saveMut.isPending || !newRow.product_id} className="min-h-12 w-full sm:w-auto">
                    {saveMut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
                    Toevoegen
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-2 rounded-md bg-muted/40 p-3 text-sm sm:grid-cols-3">
                  <div>Oppervlakte: <strong>{num.format(area(newRow))} m²</strong></div>
                  <div>Prijs/m²: <strong>{currency.format(newRow.unit_price)}</strong></div>
                  <div className="sm:text-right">Regeltotaal: <strong>{currency.format(lineTotal(newRow))}</strong></div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sticky totaalbalk — alleen mobiel */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background px-4 py-3 shadow-[0_-4px_16px_-4px_rgba(0,0,0,0.15)] sm:hidden">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Totaal</span>
          <span className="text-xl font-bold text-primary">{currency.format(grandTotal)}</span>
        </div>
      </div>
    </AppShell>
  );
}
