import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Mail, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getQuote, resendQuoteEmail, getInstallerSettings } from "@/lib/noxl.functions";

export const Route = createFileRoute("/_authenticated/quotes/$id/print")({
  head: () => ({ meta: [{ title: "Offerte — PDF" }] }),
  component: QuotePrint,
});

const currency = new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" });

function QuotePrint() {
  const { id } = Route.useParams();
  const fetchQuote = useServerFn(getQuote);
  const fetchSettings = useServerFn(getInstallerSettings);
  const resendFn = useServerFn(resendQuoteEmail);
  const [sending, setSending] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["quote", id],
    queryFn: () => fetchQuote({ data: { id } }),
  });
  const { data: settings } = useQuery({
    queryKey: ["installer-settings"],
    queryFn: () => fetchSettings(),
  });

  useEffect(() => {
    if (data) document.title = `Offerte ${data.quote.quote_number}`;
  }, [data]);

  const handleResend = async () => {
    setSending(true);
    try {
      await resendFn({ data: { quote_id: id } });
      toast.success("Offerte opnieuw verzonden naar klant");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verzenden mislukt");
    } finally {
      setSending(false);
    }
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!data) return null;
  const q = data.quote;
  const project = data.project;
  const customer = data.customer;

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-3xl p-8 print:p-0">
        <div className="mb-6 flex justify-end gap-2 print:hidden">
          <Button variant="secondary" onClick={() => window.history.back()}>Terug</Button>
          <Button variant="secondary" onClick={handleResend} disabled={sending}>
            {sending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Mail className="mr-1 h-4 w-4" />}
            Opnieuw verzenden
          </Button>
          <Button onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" /> Download PDF (print)</Button>
        </div>

        <div className="border-2 border-black p-8">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">OFFERTE</h1>
              <p className="mt-1 text-sm">{q.quote_number}</p>
              <p className="text-sm">Datum: {new Date(q.created_at).toLocaleDateString("nl-BE")}</p>
            </div>
            <div className="text-right text-sm">
              {settings?.company && <div className="text-lg font-bold">{settings.company}</div>}
              {settings?.name && <div>{settings.name}</div>}
              {settings?.address && (
                <div className="whitespace-pre-line">{settings.address}</div>
              )}
              {settings?.vat_number && <div>BTW: {settings.vat_number}</div>}
              {!settings?.company && !settings?.name && !settings?.address && !settings?.vat_number && (
                <div className="text-lg font-bold">NoXL</div>
              )}
            </div>
          </div>

          {customer && (
            <div className="mb-6 border-t border-b border-black py-4">
              <div className="text-xs uppercase tracking-wider mb-2">Klant</div>
              <div className="font-semibold">{customer.name}</div>
              {customer.company && <div>{customer.company}</div>}
              {customer.address && <div>{customer.address}</div>}
              <div>{customer.email}</div>
            </div>
          )}

          {project && (
            <div className="mb-6">
              <div className="text-xs uppercase tracking-wider mb-2">Project</div>
              <div className="font-semibold">{project.title}</div>
              {project.description && <div className="text-sm">{project.description}</div>}
            </div>
          )}

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-t-2 border-b border-black">
                <th className="text-left py-2">Omschrijving</th>
                <th className="text-right py-2">Aantal</th>
                <th className="text-right py-2">Prijs/stuk</th>
                <th className="text-right py-2">Totaal</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it) => (
                <tr key={it.id} className="border-b border-black/30">
                  <td className="py-2">{it.description}</td>
                  <td className="py-2 text-right">{it.quantity}</td>
                  <td className="py-2 text-right">{currency.format(Number(it.unit_price))}</td>
                  <td className="py-2 text-right">{currency.format(Number(it.total_price))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {(() => {
                const subtotal = Number(q.total_price);
                const vatRate = Number((project as { vat_rate?: number } | null)?.vat_rate ?? 21);
                const vat = subtotal * (vatRate / 100);
                const total = subtotal + vat;
                return (
                  <>
                    <tr className="border-t-2 border-black">
                      <td colSpan={3} className="py-2 text-right">Subtotaal</td>
                      <td className="py-2 text-right">{currency.format(subtotal)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="py-1 text-right">BTW ({vatRate}%)</td>
                      <td className="py-1 text-right">{currency.format(vat)}</td>
                    </tr>
                    <tr className="border-t border-black">
                      <td colSpan={3} className="py-2 text-right font-bold">Totaal incl. BTW</td>
                      <td className="py-2 text-right font-bold">{currency.format(total)}</td>
                    </tr>
                  </>
                );
              })()}
            </tfoot>


          </table>

          <div className="mt-8 border-t border-black/30 pt-4">
            <div className="text-xs uppercase tracking-wider mb-2 font-semibold" style={{ color: "#666" }}>
              Algemene voorwaarden
            </div>
            <div className="whitespace-pre-line text-[11px] leading-relaxed" style={{ color: "#666" }}>
              {(settings as { terms?: string | null } | undefined)?.terms?.trim() ||
                "Deze offerte is geldig gedurende 30 dagen na uitgifte. Prijzen zijn exclusief btw tenzij anders vermeld. Betaling: 30% voorschot bij bestelling, saldo bij oplevering."}
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @media print {
          @page { margin: 15mm; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}
