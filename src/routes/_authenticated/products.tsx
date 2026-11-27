import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/noxl/AppShell";
import { ProductFormDialog } from "@/components/noxl/ProductFormDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";
import { listProducts, createProduct, updateProduct, deleteProduct, listUnits, getMyRole } from "@/lib/noxl.functions";
import { getSession } from "@/lib/auth-client";
import { canCreateProducts, emptyProductForm, productToForm, type ProductFormState, type ProductWriteInput } from "@/lib/product-input";
import { resolveUnit, unitSuffix, type UnitDef } from "@/lib/units";
import { ProductImportExport } from "@/components/noxl/ProductImportExport";

export const Route = createFileRoute("/_authenticated/products")({
  validateSearch: (search: Record<string, unknown>): { product?: string } => ({
    product: typeof search.product === "string" && search.product.length > 0 ? search.product : undefined,
  }),
  head: () => ({ meta: [
    { title: "Producten — NoXL" },
    { name: "description", content: "Beheer je productcatalogus voor offertes en configuraties." },
  ] }),
  component: ProductsPage,
});

const currency = new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" });

type CatalogRow = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  unit_price: number | string;
  category: string | null;
  manufacturer: string | null;
  unit?: string | null;
};

function ProductsPage() {
  const search = Route.useSearch();
  const qc = useQueryClient();
  const fetchProducts = useServerFn(listProducts);
  const doCreate = useServerFn(createProduct);
  const doUpdate = useServerFn(updateProduct);
  const doDelete = useServerFn(deleteProduct);
  const fetchRole = useServerFn(getMyRole);

  const fetchUnits = useServerFn(listUnits);
  const products = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });
  const unitsQ = useQuery({ queryKey: ["units"], queryFn: () => fetchUnits() });
  const role = useQuery({ queryKey: ["my-role"], queryFn: () => fetchRole() });
  const session = useQuery({ queryKey: ["session"], queryFn: () => getSession() });
  const units: UnitDef[] = (unitsQ.data ?? []).map((u) => ({ ...u, basis: u.basis as UnitDef["basis"] }));
  const canCreate = canCreateProducts(role.data?.role);
  const ownerId = session.data?.user.id ?? "";

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [form, setForm] = useState<ProductFormState>(emptyProductForm());
  const openedFromSearch = useRef<string | undefined>(undefined);

  const saveMut = useMutation({
    mutationFn: async (payload: ProductWriteInput) => {
      if (editingId) return doUpdate({ data: { id: editingId, ...payload } });
      return doCreate({ data: payload });
    },
    onSuccess: () => {
      toast.success(editingId ? "Product bijgewerkt" : "Product aangemaakt");
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const delMut = useMutation({
    mutationFn: (id: string) => doDelete({ data: { id } }),
    onSuccess: () => {
      toast.success("Product verwijderd");
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setEditingId(undefined);
    setForm(emptyProductForm());
    setOpen(true);
  }
  function openEdit(product: CatalogRow) {
    setEditingId(product.id);
    setForm(productToForm(product));
    setOpen(true);
  }

  useEffect(() => {
    const productId = search.product;
    if (!productId || !canCreate || openedFromSearch.current === productId) return;
    const product = (products.data ?? []).find((row) => row.id === productId);
    if (!product) return;
    openedFromSearch.current = productId;
    openEdit(product);
  }, [search.product, products.data, canCreate]);

  return (
    <AppShell title="Producten">
      <Toaster position="top-right" richColors />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Beheer je productcatalogus. Gebruikt door de configurator.</p>
        <div className="flex flex-wrap items-center gap-2">
          {canCreate ? <ProductImportExport /> : null}
          {canCreate ? (
            <Button onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Nieuw product</Button>
          ) : null}
        </div>
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
                  <TableHead>Code</TableHead>
                  <TableHead>Naam</TableHead>
                  <TableHead>Productgroep</TableHead>
                  <TableHead>Fabrikant</TableHead>
                  <TableHead className="text-right">Basisprijs</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(products.data ?? []).map((p) => {
                  const suffix = unitSuffix(resolveUnit(units, p.unit));
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{p.code ?? "—"}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.category ?? "—"}</TableCell>
                      <TableCell>{p.manufacturer ?? "—"}</TableCell>
                      <TableCell className="text-right">{currency.format(Number(p.unit_price) || 0)} {suffix}</TableCell>
                      <TableCell className="text-right">
                        {canCreate ? (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => { if (confirm("Product verwijderen?")) delMut.mutate(p.id); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(products.data ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nog geen producten</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canCreate ? (
        <ProductFormDialog
          open={open}
          onOpenChange={setOpen}
          title={editingId ? "Product bewerken" : "Nieuw product"}
          initial={form}
          products={products.data ?? []}
          ownerId={ownerId}
          exceptId={editingId}
          units={units}
          showUnit
          pending={saveMut.isPending}
          onSave={async (value) => {
            await saveMut.mutateAsync(value);
          }}
        />
      ) : null}
    </AppShell>
  );
}
