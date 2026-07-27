import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { generateQuotePdf } from "./quote-pdf.server";

type Supa = SupabaseClient<Database>;

export async function sendQuoteEmailWithSupabase(
  supabase: Supa,
  quote_id: string,
  installerName?: string | null,
): Promise<{ ok: true; sent_to: string } | { ok: false; reason: string }> {
  const { data: quote, error: qErr } = await supabase
    .from("project_quotes")
    .select(
      "id, quote_number, total_price, created_at, project_id, projects(title, description, customers(name, email, company, address, owner_id))",
    )
    .eq("id", quote_id)
    .maybeSingle();
  if (qErr) throw new Error(qErr.message);
  if (!quote) throw new Error("Offerte niet gevonden");

  const { data: items, error: iErr } = await supabase
    .from("project_quote_items")
    .select("description, quantity, unit_price, total_price, width_mm, height_mm, unit, created_at")
    .eq("quote_id", quote_id)
    .order("created_at", { ascending: true });
  if (iErr) throw new Error(iErr.message);

  const projectRaw = quote.projects;
  const project = Array.isArray(projectRaw) ? (projectRaw[0] ?? null) : projectRaw;
  const customerRaw = project?.customers;
  const customer = Array.isArray(customerRaw) ? (customerRaw[0] ?? null) : customerRaw;
  if (!customer?.email) return { ok: false, reason: "Klant heeft geen e-mailadres" };

  // Load the installer profile for the owner of this customer.
  let installer: {
    name: string | null;
    company: string | null;
    address: string | null;
    vat_number: string | null;
    terms: string | null;
    vat_rate: number | null;
  } | null = null;
  const ownerId = customer.owner_id ?? null;
  if (ownerId) {
    const { data: s } = await supabase
      .from("installer_settings")
      .select("name, company, address, vat_number, terms, vat_rate")
      .eq("user_id", ownerId)
      .maybeSingle();
    if (s) installer = s;
  }


  const pdfBytes = await generateQuotePdf({
    quoteNumber: quote.quote_number,
    createdAt: quote.created_at,
    totalPrice: Number(quote.total_price),
    customer: customer ?? null,
    project: project ? { title: project.title, description: project.description } : null,
    installer,
    items: (items ?? []).map((it) => ({
      description: it.description,
      quantity: it.quantity,
      unit_price: Number(it.unit_price),
      total_price: Number(it.total_price),
      width_mm: Number(it.width_mm ?? 0),
      height_mm: Number(it.height_mm ?? 0),
      unit: (it.unit as "stuk" | "lengte" | "oppervlakte" | null) ?? "stuk",
    })),
  });


  let binary = "";
  for (let i = 0; i < pdfBytes.length; i++) binary += String.fromCharCode(pdfBytes[i]);
  const pdfBase64 = btoa(binary);

  const lovableApiKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableApiKey || !resendKey) throw new Error("E-mailconfiguratie ontbreekt");

  const subject = `Uw offerte ${quote.quote_number} – NoXL`;
  const signer =
    (installer?.company && installer.company.trim()) ||
    (installer?.name && installer.name.trim()) ||
    (installerName && installerName.trim()) ||
    "Uw installateur";
  const projectTitle = project?.title ?? "";
  const html = `
    <div style="font-family: Arial, sans-serif; color:#111; line-height:1.5;">
      <p>Beste ${customer.name},</p>
      <p>Hierbij ontvangt u uw offerte voor het project "<strong>${projectTitle}</strong>".</p>
      <p>U vindt de volledige offerte in de bijlage als PDF, inclusief alle details en prijzen.</p>
      <p>Met vriendelijke groeten,<br/>${signer}<br/>NoXL Offertetool</p>
    </div>
  `;

  const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableApiKey}`,
      "X-Connection-Api-Key": resendKey,
    },
    body: JSON.stringify({
      from: "NoXL <onboarding@resend.dev>",
      to: [customer.email],
      subject,
      html,
      attachments: [{ filename: `${quote.quote_number}.pdf`, content: pdfBase64 }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[sendQuoteEmail] Resend ${res.status}: ${body}`);
    throw new Error(`E-mail kon niet verzonden worden (${res.status})`);
  }

  await supabase
    .from("project_quotes")
    .update({ last_email_sent_at: new Date().toISOString() })
    .eq("id", quote_id);

  return { ok: true, sent_to: customer.email };
}
