import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/noxl/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";
import { listProducts, createProduct, updateProduct, deleteProduct } from "@/lib/noxl.functions";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({ meta: [
    { title: "Producten — NoXL" },
    { name: "description", content: "Beheer je productcatalogus voor offertes en configuraties." },
  ] }),
  component: ProductsPage,
});

const currency = new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" });

type Form = { id?: string; name: string; description: string; unit_price: number; category: string };
const empty: Form = { name: "", description: "", unit_price: 0, category: "" };

function ProductsPage() {
  const qc = useQueryClient();
  const fetchProducts = useServerFn(listProducts);
  const doCreate = useServerFn(createProduct);
  const doUpdate = useServerFn(updateProduct);
  const doDelete = useServerFn(deleteProduct);

  const products = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description || null,
        unit_price: Number(form.unit_price) || 0,
        category: form.category || null,
      };
      if (form.id) return doUpdate({ data: { id: form.id, ...payload } });
      return doCreate({ data: payload });
    },
    onSuccess: () => {
      toast.success(form.id ? "Product bijgewerkt" : "Product aangemaakt");
      setOpen(false);
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => doDelete({ data: { id } }),
    onSuccess: () => {
      toast.success("Product verwijderd");
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() { setForm(empty); setOpen(true); }
  function openEdit(p: { id: string; name: string; description: string | null; unit_price: number | string; category: string | null }) {
    setForm({
      id: p.id, name: p.name, description: p.description ?? "",
      unit_price: Number(p.unit_price) || 0, category: p.category ?? "",
    });
    setOpen(true);
  }

  return (
    <AppShell role="admin" title="Producten">
      <Toaster position="top-right" richColors />
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Beheer je productcatalogus. Gebruikt door de configurator.</p>
        <Button onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Nieuw product</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Producten</CardTitle></CardHeader>
        <CardContent>
          {products.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naam</TableHead>
                  <TableHead>Categorie</TableHead>
                  <TableHead>Beschrijving</TableHead>
                  <TableHead className="text-right">Prijs/stuk</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(products.data ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.category ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground max-w-md truncate">{p.description ?? "—"}</TableCell>
                    <TableCell className="text-right">{currency.format(Number(p.unit_price) || 0)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Product verwijderen?")) delMut.mutate(p.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(products.data ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nog geen producten</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? "Product bewerken" : "Nieuw product"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Naam</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Categorie</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="bv. Raam, Rolluik" />
            </div>
            <div className="grid gap-1.5">
              <Label>Beschrijving</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div className="grid gap-1.5">
              <Label>Prijs per stuk (€)</Label>
              <Input type="number" min={0} step="0.01" value={form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) || 0 })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.name.trim()}>
              {saveMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
