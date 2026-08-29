import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/noxl/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { getProject, saveConfigurations } from "@/lib/noxl.functions";

export const Route = createFileRoute("/_authenticated/projects/$id/configurator")({
  head: () => ({ meta: [{ title: "Configurator — NoXL" }] }),
  component: Configurator,
});

const currency = new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" });

type Row = { option_name: string; option_value: string; quantity: number; unit_price: number };

function makeRow(): Row {
  return { option_name: "", option_value: "", quantity: 1, unit_price: 0 };
}

function Configurator() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const fetchProject = useServerFn(getProject);
  const doSave = useServerFn(saveConfigurations);

  const { data, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => fetchProject({ data: { id } }),
  });

  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (data) {
      setRows(
        data.configurations.length > 0
          ? data.configurations.map((c) => ({
              option_name: c.option_name,
              option_value: c.option_value ?? "",
              quantity: c.quantity,
              unit_price: Number(c.unit_price),
            }))
          : [makeRow()],
      );
    }
  }, [data]);

  const total = rows.reduce((s, r) => s + r.quantity * r.unit_price, 0);

  const saveMut = useMutation({
    mutationFn: () =>
      doSave({
        data: {
          project_id: id,
          items: rows
            .filter((r) => r.option_name.trim().length > 0)
            .map((r) => ({
              option_name: r.option_name,
              option_value: r.option_value || null,
              quantity: r.quantity,
              unit_price: r.unit_price,
            })),
        },
      }),
    onSuccess: () => {
      toast.success("Configuratie opgeslagen");
      navigate({ to: "/projects/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  return (
    <AppShell title="Configurator">
      <Toaster position="top-right" richColors />
      <div className="mb-4"><Button variant="ghost" size="sm" asChild><Link to="/projects/$id" params={{ id }}><ArrowLeft className="mr-1 h-4 w-4" /> Terug naar project</Link></Button></div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Configuratieregels</CardTitle>
          <div className="text-sm">Totaal: <strong>{currency.format(total)}</strong></div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <div className="grid grid-cols-[1fr_1fr_90px_120px_120px_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
              <span>Optienaam</span><span>Waarde</span><span className="text-right">Aantal</span><span className="text-right">Prijs/stuk</span><span className="text-right">Totaal</span><span />
            </div>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_90px_120px_120px_40px] gap-2 items-center">
                <Input value={r.option_name} onChange={(e) => update(i, { option_name: e.target.value })} placeholder="bv. Raamtype" />
                <Input value={r.option_value} onChange={(e) => update(i, { option_value: e.target.value })} placeholder="bv. Dubbel glas" />
                <Input type="number" min={0} value={r.quantity} onChange={(e) => update(i, { quantity: Number(e.target.value) || 0 })} className="text-right" />
                <Input type="number" min={0} step="0.01" value={r.unit_price} onChange={(e) => update(i, { unit_price: Number(e.target.value) || 0 })} className="text-right" />
                <div className="text-right text-sm">{currency.format(r.quantity * r.unit_price)}</div>
                <Button variant="ghost" size="icon" onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))} disabled={rows.length === 1}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" onClick={() => setRows((p) => [...p, makeRow()])}><Plus className="mr-1 h-4 w-4" /> Regel toevoegen</Button>
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>{saveMut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Opslaan</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
