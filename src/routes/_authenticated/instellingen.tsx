import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { AppShell } from "@/components/noxl/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { getInstallerSettings, updateInstallerSettings } from "@/lib/noxl.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/instellingen")({
  head: () => ({
    meta: [
      { title: "Instellingen — NoXL" },
      { name: "description", content: "Beheer je bedrijfsgegevens die op offertes verschijnen." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getInstallerSettings);
  const saveSettings = useServerFn(updateInstallerSettings);

  const { data, isLoading } = useQuery({
    queryKey: ["installer-settings"],
    queryFn: () => fetchSettings(),
  });

  const [form, setForm] = useState({ name: "", company: "", address: "", vat_number: "", terms: "", vat_rate: 21 as 6 | 21 });

  useEffect(() => {
    if (data) {
      const rate = Number((data as { vat_rate?: number }).vat_rate ?? 21);
      setForm({
        name: data.name ?? "",
        company: data.company ?? "",
        address: data.address ?? "",
        vat_number: data.vat_number ?? "",
        terms: (data as { terms?: string | null }).terms ?? "",
        vat_rate: rate === 6 ? 6 : 21,
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      saveSettings({
        data: {
          name: form.name.trim() || null,
          company: form.company.trim() || null,
          address: form.address.trim() || null,
          vat_number: form.vat_number.trim() || null,
          terms: form.terms.trim() || null,
          vat_rate: form.vat_rate,
        },
      }),
    onSuccess: () => {
      toast.success("Instellingen opgeslagen");
      qc.invalidateQueries({ queryKey: ["installer-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <AppShell role="admin" title="Instellingen">
      <Toaster position="top-right" richColors />
      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Bedrijfsgegevens</CardTitle>
            <CardDescription>Deze gegevens verschijnen in de hoofding van je offertes en op de PDF.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutation.mutate();
              }}
              className="grid gap-4"
            >
              <div className="grid gap-1.5">
                <Label htmlFor="name">Naam</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Jan Janssens"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="company">Vennootschap</Label>
                <Input
                  id="company"
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="Janssens Ramen BV"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="address">Adres</Label>
                <Textarea
                  id="address"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Straat 1, 2000 Antwerpen"
                  rows={3}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="vat">Btw-nummer</Label>
                <Input
                  id="vat"
                  value={form.vat_number}
                  onChange={(e) => setForm((f) => ({ ...f, vat_number: e.target.value }))}
                  placeholder="BE0123.456.789"
                />
              </div>
              <div className="grid gap-1.5 pt-4 border-t">
                <Label htmlFor="vat_rate" className="text-base font-semibold">BTW-tarief</Label>
                <p className="text-xs text-muted-foreground">
                  Dit tarief wordt automatisch toegepast op alle nieuwe en bestaande offertes.
                </p>
                <select
                  id="vat_rate"
                  value={form.vat_rate}
                  onChange={(e) => setForm((f) => ({ ...f, vat_rate: Number(e.target.value) === 6 ? 6 : 21 }))}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value={6}>6%</option>
                  <option value={21}>21%</option>
                </select>
              </div>
              <div className="grid gap-1.5 pt-4 border-t">

                <Label htmlFor="terms" className="text-base font-semibold">Algemene voorwaarden</Label>
                <p className="text-xs text-muted-foreground">
                  Deze tekst verschijnt onderaan elke offerte-PDF en op de offerte-detailpagina.
                </p>
                <Textarea
                  id="terms"
                  value={form.terms}
                  onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))}
                  placeholder={`1. Deze offerte is geldig gedurende 30 dagen na uitgifte.\n2. Prijzen zijn exclusief btw tenzij anders vermeld.\n3. Betaling: 30% voorschot bij bestelling, saldo bij oplevering.\n4. Uitvoeringstermijn: in onderling overleg te bepalen.\n5. Klachten dienen binnen 8 dagen na levering schriftelijk gemeld te worden.\n6. Op deze offerte is het Belgisch recht van toepassing.`}
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Bezig…</>
                  ) : (
                    <><Save className="mr-2 h-4 w-4" /> Opslaan</>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
