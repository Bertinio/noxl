import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/noxl/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import {
  getMyRole,
  getInstallerDetail,
  removeInstaller,
  updateUserRole,
} from "@/lib/noxl.functions";

export const Route = createFileRoute("/_authenticated/beheer/installateurs/$id")({
  head: () => ({
    meta: [
      { title: "Installateur — NoXL" },
      { name: "description", content: "Detailpagina voor een installateur." },
    ],
  }),
  component: InstallerDetailPage,
});

type AppRole = "admin" | "installer" | "customer";
const currency = new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" });

function InstallerDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchRole = useServerFn(getMyRole);
  const fetchDetail = useServerFn(getInstallerDetail);
  const doRemove = useServerFn(removeInstaller);
  const doUpdateRole = useServerFn(updateUserRole);

  const role = useQuery({ queryKey: ["my-role"], queryFn: () => fetchRole() });
  const detail = useQuery({
    queryKey: ["installer-detail", id],
    queryFn: () => fetchDetail({ data: { user_id: id } }),
    enabled: role.data?.role === "admin",
  });

  const [roleOpen, setRoleOpen] = useState(false);
  const [newRole, setNewRole] = useState<AppRole>("installer");

  const removeMut = useMutation({
    mutationFn: () => doRemove({ data: { user_id: id } }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success("Installateur verwijderd");
        qc.invalidateQueries({ queryKey: ["installers"] });
        navigate({ to: "/beheer/installateurs" });
      } else {
        toast.error(res.message);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleMut = useMutation({
    mutationFn: (r: AppRole) => doUpdateRole({ data: { user_id: id, role: r } }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success("Rol bijgewerkt");
        setRoleOpen(false);
        qc.invalidateQueries({ queryKey: ["installer-detail", id] });
        qc.invalidateQueries({ queryKey: ["installers"] });
      } else {
        toast.error(res.message);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (role.isLoading || detail.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (role.data?.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p>Alleen beheerders hebben toegang tot deze pagina.</p>
      </div>
    );
  }
  if (!detail.data) {
    return (
      <AppShell title="Installateur">
        <p className="text-muted-foreground">Niet gevonden.</p>
      </AppShell>
    );
  }

  const d = detail.data;

  return (
    <AppShell title={d.user.email || "Installateur"}>
      <Toaster position="top-right" richColors />
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/beheer/installateurs">
            <ArrowLeft className="mr-1 h-4 w-4" /> Terug
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bedrijfsgegevens</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Row label="E-mail" value={d.user.email || "—"} />
            <Row label="Naam" value={d.settings?.name ?? "—"} />
            <Row label="Vennootschap" value={d.settings?.company ?? "—"} />
            <Row label="Adres" value={d.settings?.address ?? "—"} />
            <Row label="Btw-nummer" value={d.settings?.vat_number ?? "—"} />
            <Row
              label="Laatste login"
              value={d.user.last_sign_in_at ? new Date(d.user.last_sign_in_at).toLocaleString("nl-BE") : "—"}
            />
            <div className="pt-2">
              <div className="text-muted-foreground text-xs mb-1">Rollen</div>
              <div className="flex flex-wrap gap-1">
                {d.roles.length === 0 && <Badge variant="outline">Geen</Badge>}
                {d.roles.map((r) => (
                  <Badge
                    key={r}
                    variant={r === "admin" ? "default" : r === "installer" ? "secondary" : "outline"}
                  >
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const current: AppRole = d.roles.includes("admin")
                    ? "admin"
                    : d.roles.includes("installer")
                      ? "installer"
                      : "customer";
                  setNewRole(current);
                  setRoleOpen(true);
                }}
              >
                <Pencil className="mr-1 h-3 w-3" /> Rol wijzigen
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={removeMut.isPending}
                onClick={() => {
                  if (confirm("Installateur verwijderen?")) removeMut.mutate();
                }}
              >
                <Trash2 className="mr-1 h-3 w-3" /> Installateur verwijderen
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Statistieken</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Stat label="Offertes gegenereerd" value={d.counts.generated} />
            <Stat label="Offertes verstuurd" value={d.counts.sent} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Gegenereerde offertes</CardTitle>
          </CardHeader>
          <CardContent>
            <QuoteTable rows={d.generated} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verstuurde offertes</CardTitle>
          </CardHeader>
          <CardContent>
            <QuoteTable rows={d.sent} showSentAt />
          </CardContent>
        </Card>
      </div>

      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rol wijzigen</DialogTitle>
            <DialogDescription>Kies een nieuwe rol voor deze gebruiker.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              roleMut.mutate(newRole);
            }}
            className="grid gap-3"
          >
            <div className="grid gap-1.5">
              <Label>Rol</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">admin</SelectItem>
                  <SelectItem value="installer">installer</SelectItem>
                  <SelectItem value="customer">customer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setRoleOpen(false)}>
                Annuleren
              </Button>
              <Button type="submit" disabled={roleMut.isPending}>
                {roleMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Opslaan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium break-words">{value}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function QuoteTable({
  rows,
  showSentAt,
}: {
  rows: Array<{
    id: string;
    quote_number: string;
    total_price: number;
    created_at: string;
    last_email_sent_at: string | null;
  }>;
  showSentAt?: boolean;
}) {
  if (rows.length === 0) {
    return <div className="text-muted-foreground text-center py-6">Geen offertes</div>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nummer</TableHead>
          <TableHead>Datum</TableHead>
          {showSentAt ? <TableHead>Verstuurd op</TableHead> : null}
          <TableHead className="text-right">Totaal</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((q) => (
          <TableRow key={q.id}>
            <TableCell className="font-mono text-sm">{q.quote_number}</TableCell>
            <TableCell>{new Date(q.created_at).toLocaleDateString("nl-BE")}</TableCell>
            {showSentAt ? (
              <TableCell>
                {q.last_email_sent_at ? new Date(q.last_email_sent_at).toLocaleString("nl-BE") : "—"}
              </TableCell>
            ) : null}
            <TableCell className="text-right tabular-nums">
              {currency.format(Number(q.total_price ?? 0))}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
