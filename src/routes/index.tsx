import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ruler, Package, FileText, CheckCircle2, Loader2 } from "lucide-react";

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
          "Maak in seconden een nette offerte voor ramen en rolluiken: bereken oppervlakte en prijs, en sla elke offerte veilig op.",
      },
      { property: "og:title", content: "Offertetool voor raam- en rolluikinstallateurs" },
      {
        property: "og:description",
        content:
          "Bereken direct oppervlakte en totaalprijs, en sla elke offerte veilig op met een uniek offertenummer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type ProductType = "raam" | "rolluik";

function Index() {
  const saveQuote = useServerFn(createQuote);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [productType, setProductType] = useState<ProductType>("raam");
  const [widthMm, setWidthMm] = useState<string>("");
  const [heightMm, setHeightMm] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastQuoteNumber, setLastQuoteNumber] = useState<string | null>(null);

  const width = Number(widthMm);
  const height = Number(heightMm);
  const hasDims = width > 0 && height > 0;

  const { areaM2, total } = useMemo(() => {
    if (!hasDims) return { areaM2: 0, total: 0 };
    const a = (width * height) / 1_000_000;
    return { areaM2: a, total: a * UNIT_PRICE };
  }, [width, height, hasDims]);

  function reset() {
    setCustomerName("");
    setCustomerEmail("");
    setProductType("raam");
    setWidthMm("");
    setHeightMm("");
    setNotes("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerName.trim() || !customerEmail.trim() || !hasDims) {
      toast.error("Vul alle verplichte velden in.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await saveQuote({
        data: {
          customer_name: customerName.trim(),
          customer_email: customerEmail.trim(),
          product_type: productType,
          width_mm: Math.round(width),
          height_mm: Math.round(height),
          notes: notes.trim() || null,
        },
      });
      setLastQuoteNumber(result!.quote_number);
      toast.success(`Offerte ${result!.quote_number} opgeslagen`, {
        description: `${currency.format(Number(result!.total_ex_vat))} excl. btw`,
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
              Ramen &amp; rolluiken — snelle prijsberekening
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1.2fr_1fr]">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"
        >
          <div className="mb-6 flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Nieuwe offerte</h2>
          </div>

          <div className="grid gap-5">
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

            <div className="grid gap-2">
              <Label htmlFor="product_type">Type product</Label>
              <Select
                value={productType}
                onValueChange={(v) => setProductType(v as ProductType)}
              >
                <SelectTrigger id="product_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="raam">Raam</SelectItem>
                  <SelectItem value="rolluik">Rolluik</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="width_mm">Breedte (mm)</Label>
                <Input
                  id="width_mm"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={20000}
                  value={widthMm}
                  onChange={(e) => setWidthMm(e.target.value)}
                  placeholder="1200"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="height_mm">Hoogte (mm)</Label>
                <Input
                  id="height_mm"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={20000}
                  value={heightMm}
                  onChange={(e) => setHeightMm(e.target.value)}
                  placeholder="1500"
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notities / opmerkingen</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optioneel — bijzonderheden, kleur, montagelocatie…"
                rows={4}
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
              Live berekening
            </div>
            <div className="mt-4 text-sm opacity-80">Totaalprijs excl. btw</div>
            <div className="mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">
              {currency.format(total)}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="opacity-70">Oppervlakte</div>
                <div className="mt-1 font-medium">
                  {number.format(areaM2)} m²
                </div>
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
            <dl className="mt-4 space-y-3 text-sm">
              <SummaryRow label="Product" value={productType === "raam" ? "Raam" : "Rolluik"} />
              <SummaryRow
                label="Afmetingen"
                value={hasDims ? `${width} × ${height} mm` : "—"}
              />
              <SummaryRow
                label="Oppervlakte"
                value={hasDims ? `${number.format(areaM2)} m²` : "—"}
              />
              <SummaryRow
                label="Totaal excl. btw"
                value={hasDims ? currency.format(total) : "—"}
                emphasis
              />
            </dl>
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

function SummaryRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2 last:border-none last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          emphasis ? "font-semibold text-foreground" : "font-medium text-foreground"
        }
      >
        {value}
      </dd>
    </div>
  );
}
