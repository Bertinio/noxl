import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Ruler, Settings as SettingsIcon } from "lucide-react";
import type { Session } from "@supabase/supabase-js";

import { getMySettings, updateMyUnitPrice } from "@/lib/quotes.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Instellingen — Offertetool" },
      {
        name: "description",
        content: "Beheer je eigen prijs per m² voor offertes.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === null) navigate({ to: "/auth", replace: true });
  }, [session, navigate]);

  if (session === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!session) return null;

  return <SettingsForm />;
}

function SettingsForm() {
  const queryClient = useQueryClient();
  const fetchSettings = useServerFn(getMySettings);
  const saveUnitPrice = useServerFn(updateMyUnitPrice);

  const settings = useQuery({
    queryKey: ["my-settings"],
    queryFn: () => fetchSettings(),
  });

  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings.data && price === "") {
      setPrice(String(settings.data.unit_price));
    }
  }, [settings.data, price]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(price);
    if (!(value > 0)) {
      toast.error("Voer een geldige prijs in.");
      return;
    }
    setSaving(true);
    try {
      const result = await saveUnitPrice({ data: { unit_price: value } });
      queryClient.setQueryData(["my-settings"], result);
      queryClient.invalidateQueries({ queryKey: ["my-settings"] });
      toast.success("Prijs opgeslagen", {
        description: `Nieuwe prijs: € ${result!.unit_price.toFixed(2)} / m²`,
      });
    } catch (err) {
      toast.error("Opslaan mislukt", {
        description: err instanceof Error ? err.message : "Probeer het opnieuw.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" richColors />

      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <SettingsIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                Instellingen
              </h1>
              <p className="text-xs text-muted-foreground">
                Je persoonlijke prijs per m²
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Terug
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"
        >
          <div className="mb-6 flex items-center gap-2">
            <Ruler className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Basisprijs</h2>
          </div>

          <div className="grid gap-2 sm:max-w-xs">
            <Label htmlFor="unit_price">Prijs per m² (excl. btw)</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">€</span>
              <Input
                id="unit_price"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0.01}
                max={100000}
                value={settings.isLoading ? "" : price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="150"
                disabled={settings.isLoading}
                required
              />
              <span className="whitespace-nowrap text-sm text-muted-foreground">
                / m²
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Deze prijs wordt gebruikt voor de live berekening én bij het opslaan
              van nieuwe offertes. Reeds opgeslagen offertes behouden hun eigen prijs.
            </p>
          </div>

          <Button type="submit" disabled={saving || settings.isLoading} className="mt-6">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Opslaan…
              </>
            ) : (
              "Prijs opslaan"
            )}
          </Button>
        </form>
      </main>
    </div>
  );
}
