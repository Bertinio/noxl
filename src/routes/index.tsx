import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Ruler,
  Package,
  FileText,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";

import { createQuote } from "@/lib/quotes.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";

const UNIT_PRICE = 150;
const currency = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});
const number = new Intl.NumberFormat("nl-NL", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Offertetool voor raam- en rolluikinstallateurs" },
      {
        name: "description",
        content:
          "Maak in seconden een nette offerte met meerdere producten: bereken oppervlakte en prijs, en sla elke offerte veilig op.",
      },
      { property: "og:title", content: "Offertetool voor raam- en rolluikinstallateurs" },
      {
        property: "og:description",
        content:
          "Voeg meerdere ramen en rolluiken toe aan één offerte, met directe berekening en veilige opslag.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type ProductType = "raam" | "rolluik";

type LineItem = {
  key: string;
  product_type: ProductType;
  width_mm: string;
  height_mm: string;
  notes: string;
};

function newItem(): LineItem {
  return {
    key: crypto.randomUUID(),
    product_type: "raam",
    width_mm: "",
    height_mm: "",
    notes: "",
  };
}

function itemArea(item: LineItem) {
  const w = Number(item.width_mm);
  const h = Number(item.height_mm);
  if (!(w > 0) || !(h > 0)) return 0;
  return (w * h) / 1_000_000;
}

function Index() {
  const saveQuote = useServerFn(createQuote);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([newItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [lastQuoteNumber, setLastQuoteNumber] = useState<string | null>(null);

  const totals = useMemo(() => {
    const rows = items.map((it) => {
      const area = itemArea(it);
      return { area, total: area * UNIT_PRICE };
    });
    const area = rows.reduce((s, r) => s + r.area, 0);
    const total = rows.reduce((s, r) => s + r.total, 0);
    return { rows, area, total };
  }, [items]);

  function updateItem(key: string, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function removeItem(key: string) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((it) => it.key !== key)));
  }

  function addItem() {
    setItems((prev) => [...prev, newItem()]);
  }

  function reset() {
    setCustomerName("");
    setCustomerEmail("");
    setQuoteNotes("");
    setItems([newItem()]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerName.trim() || !customerEmail.trim()) {
      toast.error("Vul klantnaam en e-mailadres in.");
      return;
    }
    const invalid = items.find(
      (it) => !(Number(it.width_mm) > 0) || !(Number(it.height_mm) > 0),
    );
    if (invalid) {
      toast.error("Elk product heeft geldige afmetingen nodig.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await saveQuote({
        data: {
          customer_name: customerName.trim(),
          customer_email: customerEmail.trim(),
          notes: quoteNotes.trim() || null,
          items: items.map((it) => ({
            product_type: it.product_type,
            width_mm: Math.round(Number(it.width_mm)),
            height_mm: Math.round(Number(it.height_mm)),
            notes: it.notes.trim() || null,
          })),
        },
      });
      setLastQuoteNumber(result!.quote_number);
      toast.success(`Offerte ${result!.quote_number} opgeslagen`, {
        description: `${result!.items.length} product(en) — ${currency.format(
          Number(result!.total_ex_vat),
        )} excl. btw`,
      });
      reset();
    } catch (err) {
      console.error(err);
      toast.error("Opslaan mislukt", {
        description: err instanceof Error ? err.message : "Probeer het opnieuw.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" richColors />

      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-5 sm:px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Ruler className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              Offertetool
            </h1>
            <p className="text-xs text-muted-foreground">
              Ramen &amp; rolluiken — meerdere producten per offerte
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1.3fr_1fr]">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"
        >
          <div className="mb-6 flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Nieuwe offerte</h2>
          </div>

          <div className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="customer_name">Klantnaam</Label>
                <Input
                  id="customer_name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Bijv. Jan de Vries"
                  maxLength={200}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="customer_email">E-mailadres klant</Label>
                <Input
                  id="customer_email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="klant@voorbeeld.nl"
                  maxLength={255}
                  required
                />
              </div>
            </div>

            <div className="mt-2">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Producten</h3>
                <span className="text-xs text-muted-foreground">
                  {items.length} {items.length === 1 ? "product" : "producten"}
                </span>
              </div>

              <div className="space-y-4">
                {items.map((item, idx) => {
                  const area = totals.rows[idx]?.area ?? 0;
                  const total = totals.rows[idx]?.total ?? 0;
                  return (
                    <div
                      key={item.key}
                      className="rounded-xl border border-border bg-background/60 p-4 sm:p-5"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Product {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeItem(item.key)}
                          disabled={items.length <= 1}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Product verwijderen"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Verwijder
                        </button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="grid gap-2 sm:col-span-1">
                          <Label htmlFor={`type-${item.key}`}>Type</Label>
                          <Select
                            value={item.product_type}
                            onValueChange={(v) =>
                              updateItem(item.key, { product_type: v as ProductType })
                            }
                          >
                            <SelectTrigger id={`type-${item.key}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="raam">Raam</SelectItem>
                              <SelectItem value="rolluik">Rolluik</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor={`w-${item.key}`}>Breedte (mm)</Label>
                          <Input
                            id={`w-${item.key}`}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={20000}
                            value={item.width_mm}
                            onChange={(e) =>
                              updateItem(item.key, { width_mm: e.target.value })
                            }
                            placeholder="1200"
                            required
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor={`h-${item.key}`}>Hoogte (mm)</Label>
                          <Input
                            id={`h-${item.key}`}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={20000}
                            value={item.height_mm}
                            onChange={(e) =>
                              updateItem(item.key, { height_mm: e.target.value })
                            }
                            placeholder="1500"
                            required
                          />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2">
                        <Label htmlFor={`n-${item.key}`}>Opmerking (optioneel)</Label>
                        <Input
                          id={`n-${item.key}`}
                          value={item.notes}
                          onChange={(e) => updateItem(item.key, { notes: e.target.value })}
                          placeholder="Bijv. kleur, locatie…"
                          maxLength={1000}
                        />
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
                        <span className="text-muted-foreground">
                          {area > 0 ? `${number.format(area)} m²` : "—"}
                        </span>
                        <span className="font-medium text-foreground">
                          {currency.format(total)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={addItem}
                className="mt-4 w-full sm:w-auto"
              >
                <Plus className="mr-2 h-4 w-4" />
                Product toevoegen
              </Button>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="quote_notes">Algemene notities / opmerkingen</Label>
              <Textarea
                id="quote_notes"
                value={quoteNotes}
                onChange={(e) => setQuoteNotes(e.target.value)}
                placeholder="Optioneel — bijzonderheden over de offerte…"
                rows={3}
                maxLength={2000}
              />
            </div>

            <Button type="submit" disabled={submitting} className="mt-2 w-full sm:w-auto">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Bezig met opslaan…
                </>
              ) : (
                "Offerte opslaan"
              )}
            </Button>
          </div>
        </form>

        <aside className="flex flex-col gap-4">
          <section className="rounded-2xl border border-border bg-primary p-6 text-primary-foreground shadow-sm sm:p-8">
            <div className="flex items-center gap-2 text-sm opacity-80">
              <Package className="h-4 w-4" />
              Live totaal
            </div>
            <div className="mt-4 text-sm opacity-80">Totaalprijs excl. btw</div>
            <div className="mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">
              {currency.format(totals.total)}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="opacity-70">Totale oppervlakte</div>
                <div className="mt-1 font-medium">{number.format(totals.area)} m²</div>
              </div>
              <div>
                <div className="opacity-70">Basisprijs</div>
                <div className="mt-1 font-medium">
                  {currency.format(UNIT_PRICE)} / m²
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <h3 className="text-sm font-semibold text-foreground">Samenvatting</h3>
            <ul className="mt-4 space-y-3 text-sm">
              {items.map((it, idx) => {
                const row = totals.rows[idx];
                const hasDims = row && row.area > 0;
                return (
                  <li
                    key={it.key}
                    className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-none last:pb-0"
                  >
                    <div>
                      <div className="font-medium text-foreground">
                        {idx + 1}. {it.product_type === "raam" ? "Raam" : "Rolluik"}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {hasDims
                          ? `${it.width_mm} × ${it.height_mm} mm · ${number.format(row!.area)} m²`
                          : "afmetingen ontbreken"}
                      </div>
                    </div>
                    <div className="whitespace-nowrap text-sm font-medium text-foreground">
                      {hasDims ? currency.format(row!.total) : "—"}
                    </div>
                  </li>
                );
              })}
              <li className="flex items-center justify-between pt-1 text-sm">
                <span className="font-semibold text-foreground">Totaal excl. btw</span>
                <span className="font-semibold text-foreground">
                  {currency.format(totals.total)}
                </span>
              </li>
            </ul>
          </section>

          {lastQuoteNumber && (
            <section className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="text-sm">
                <div className="font-medium text-foreground">Laatst opgeslagen offerte</div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  {lastQuoteNumber}
                </div>
              </div>
            </section>
          )}
        </aside>
      </main>
    </div>
  );
}
