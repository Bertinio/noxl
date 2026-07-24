import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/noxl/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";
import { getProject, saveConfigurations } from "@/lib/noxl.functions";

export const Route = createFileRoute("/_authenticated/project/$projectId/configurator")({
  head: () => ({ meta: [{ title: "Configurator — NoXL" }] }),
  component: Configurator,
});

const currency = new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" });

type Row = { option_name: string; option_value: string; quantity: number; unit_price: number };

function makeRow(): Row {
  return { option_name: "", option_value: "", quantity: 1, unit_price: 0 };
}

export default function Configurator() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const fetchProject = useServerFn(getProject);
  const doSave = useServerFn(saveConfigurations);

  const { data, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => fetchProject({ data: { id: projectId } }),
  });

  const [existingRows, setExistingRows] = useState<Row[]>([]);
  const [newRow, setNewRow] = useState<Row>(makeRow());

  useEffect(() => {
    if (data) {
      setExistingRows(
        data.configurations.map((c) => ({
          option_name: c.option_name,
          option_value: c.option_value ?? "",
          quantity: c.quantity,
          unit_price: Number(c.unit_price),
        })),
      );
    }
  }, [data]);

  const allRows = useMemo(() => existingRows, [existingRows]);
  const totalExisting = allRows.reduce((s, r) => s + r.quantity * r.unit_price, 0);
  const newRowTotal = newRow.quantity * newRow.unit_price;
  const grandTotal = totalExisting + (newRow.option_name.trim() ? newRowTotal : 0);

  const saveMut = useMutation({
    mutationFn: (items: Row[]) =>
      doSave({
        data: {
          project_id: projectId,
          items: items
            .filter((r) => r.option_name.trim().length > 0)
            .map((r) => ({
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

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!data) return null;

  function addRule() {
    if (!newRow.option_name.trim()) {
      toast.error("Geef een optienaam op");
      return;
    }
    const next = [...existingRows, newRow];
    setExistingRows(next);
    setNewRow(makeRow());
    saveMut.mutate(next);
  }

  function removeRule(i: number) {
    const next = existingRows.filter((_, idx) => idx !== i);
    setExistingRows(next);
    saveMut.mutate(next);
  }

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
          <CardHeader><CardTitle>Project: {data.project.title}</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {data.project.description ?? "Geen beschrijving"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Configuratieregels</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Optie</TableHead>
                  <TableHead>Waarde</TableHead>
                  <TableHead className="text-right">Aantal</TableHead>
                  <TableHead className="text-right">Prijs/stuk</TableHead>
                  <TableHead className="text-right">Totaal</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {existingRows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.option_name}</TableCell>
                    <TableCell>{r.option_value || "—"}</TableCell>
                    <TableCell className="text-right">{r.quantity}</TableCell>
                    <TableCell className="text-right">{currency.format(r.unit_price)}</TableCell>
                    <TableCell className="text-right">{currency.format(r.quantity * r.unit_price)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => removeRule(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {existingRows.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nog geen regels</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Nieuwe regel toevoegen</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-[1fr_1fr_90px_120px_120px_auto] gap-2 items-end">
              <div className="grid gap-1.5">
                <label className="text-xs text-muted-foreground">Optienaam</label>
                <Input value={newRow.option_name} onChange={(e) => setNewRow({ ...newRow, option_name: e.target.value })} placeholder="bv. Raamtype" />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs text-muted-foreground">Waarde</label>
                <Input value={newRow.option_value} onChange={(e) => setNewRow({ ...newRow, option_value: e.target.value })} placeholder="bv. Dubbel glas" />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs text-muted-foreground">Aantal</label>
                <Input type="number" min={0} value={newRow.quantity} onChange={(e) => setNewRow({ ...newRow, quantity: Number(e.target.value) || 0 })} className="text-right" />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs text-muted-foreground">Prijs/stuk</label>
                <Input type="number" min={0} step="0.01" value={newRow.unit_price} onChange={(e) => setNewRow({ ...newRow, unit_price: Number(e.target.value) || 0 })} className="text-right" />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs text-muted-foreground">Regeltotaal</label>
                <div className="h-9 flex items-center justify-end text-sm font-medium">{currency.format(newRowTotal)}</div>
              </div>
              <Button onClick={addRule} disabled={saveMut.isPending}>
                {saveMut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
                Toevoegen
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
