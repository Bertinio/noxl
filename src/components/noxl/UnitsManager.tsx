import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listUnits, createUnit, updateUnit, deleteUnit } from "@/lib/noxl.functions";
import { UNIT_BASES, isUnitBasis, type UnitBasis } from "@/lib/units";

type Scope = "global" | "own";

type Form = {
  id?: string;
  code: string;
  label: string;
  symbol: string;
  basis: UnitBasis;
  active: boolean;
};

const empty: Form = { code: "", label: "", symbol: "", basis: "stuk", active: true };

function slug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export function UnitsManager({ scope }: { scope: Scope }) {
  const qc = useQueryClient();
  const fetchUnits = useServerFn(listUnits);
  const doCreate = useServerFn(createUnit);
  const doUpdate = useServerFn(updateUnit);
  const doDelete = useServerFn(deleteUnit);

  const unitsQ = useQuery({ queryKey: ["units"], queryFn: () => fetchUnits() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);

  const rows = unitsQ.data ?? [];


  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code || slug(form.label),
        label: form.label,
        symbol: form.symbol || "stuk",
        basis: form.basis,
        active: form.active,
      };
      if (form.id) return doUpdate({ data: { id: form.id, ...payload } });
      return doCreate({ data: { ...payload, scope } });
    },
    onSuccess: () => {
      toast.success(form.id ? "Eenheid bijgewerkt" : "Eenheid toegevoegd");
      setOpen(false);
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["units"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => doDelete({ data: { id } }),
    onSuccess: () => {
      toast.success("Eenheid verwijderd");
      qc.invalidateQueries({ queryKey: ["units"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setForm(empty);
    setOpen(true);
  }

  function openEdit(u: { id: string; code: string; label: string; symbol: string; basis: string; active: boolean }) {
    setForm({
      id: u.id,
      code: u.code,
      label: u.label,
      symbol: u.symbol,
      basis: isUnitBasis(u.basis) ? u.basis : "stuk",
      active: u.active,
    });
    setOpen(true);
  }

  const canManage = (ownerId: string | null) => (ownerId === null ? scope === "global" : true);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Eenheden</CardTitle>
          <CardDescription>
            {scope === "global"
              ? "Globale eenheden zijn beschikbaar voor alle installateurs."
              : "Naast de globale eenheden kun je hier je eigen eenheden toevoegen."}
          </CardDescription>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" />
          {scope === "global" ? "Globale eenheid" : "Eigen eenheid"}
        </Button>
      </CardHeader>
      <CardContent>
        {unitsQ.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Naam</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Symbool</TableHead>
                    <TableHead>Rekentype</TableHead>
                    <TableHead>Bereik</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.label}</TableCell>
                      <TableCell className="text-muted-foreground">{u.code}</TableCell>
                      <TableCell>{u.symbol}</TableCell>
                      <TableCell>{UNIT_BASES.find((b) => b.value === u.basis)?.label ?? u.basis}</TableCell>
                      <TableCell>
                        <Badge variant={u.owner_id === null ? "secondary" : "outline"}>
                          {u.owner_id === null ? "Globaal" : "Eigen"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.active ? "default" : "secondary"}>
                          {u.active ? "Actief" : "Inactief"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canManage(u.owner_id) ? (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm(`Eenheid "${u.label}" verwijderen?`)) delMut.mutate(u.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">Beheerd door admin</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        Nog geen eenheden
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile */}
            <div className="grid gap-3 sm:hidden">
              {rows.map((u) => (
                <div key={u.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{u.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {u.code} · {u.symbol}
                      </p>
                    </div>
                    <Badge variant={u.owner_id === null ? "secondary" : "outline"}>
                      {u.owner_id === null ? "Globaal" : "Eigen"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm">
                    {UNIT_BASES.find((b) => b.value === u.basis)?.label ?? u.basis}
                  </p>
                  {canManage(u.owner_id) && (
                    <div className="mt-3 flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(u)}>
                        <Pencil className="mr-1 h-4 w-4" /> Wijzigen
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Eenheid "${u.label}" verwijderen?`)) delMut.mutate(u.id);
                        }}
                      >
                        <Trash2 className="mr-1 h-4 w-4" /> Verwijderen
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Eenheid bewerken" : "Nieuwe eenheid"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Naam</Label>
              <Input
                value={form.label}
                placeholder="bv. Set, Rol, Vierkante meter"
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    label: e.target.value,
                    code: f.id ? f.code : slug(e.target.value),
                  }))
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Code</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: slug(e.target.value) })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Symbool</Label>
                <Input
                  value={form.symbol}
                  placeholder="bv. stuk, m, m², set"
                  onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Rekentype</Label>
              <Select
                value={form.basis}
                onValueChange={(v) => setForm({ ...form, basis: isUnitBasis(v) ? v : "stuk" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_BASES.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label} ({b.hint})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Actief</p>
                <p className="text-xs text-muted-foreground">Inactieve eenheden verschijnen niet in keuzelijsten.</p>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuleren
            </Button>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending || !form.label.trim() || !form.symbol.trim()}
            >
              {saveMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
