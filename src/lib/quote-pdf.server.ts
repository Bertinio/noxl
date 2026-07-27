import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type Unit = "stuk" | "lengte" | "oppervlakte";
type Item = {
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  width_mm?: number;
  height_mm?: number;
  unit?: Unit | null;
};

type QuotePdfInput = {
  quoteNumber: string;
  createdAt: string;
  totalPrice: number;
  customer: { name: string; email: string; company: string | null; address: string | null } | null;
  project: { title: string; description: string | null } | null;
  installer?: { name: string | null; company: string | null; address: string | null; vat_number: string | null; terms?: string | null; vat_rate?: number | null } | null;
  items: Item[];
};


const eur = (n: number) =>
  new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(n);

export async function generateQuotePdf(input: QuotePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const { width } = page.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);

  const marginX = 50;
  let y = 800;

  const draw = (
    text: string,
    x: number,
    yy: number,
    opts: { size?: number; font?: typeof font; color?: ReturnType<typeof rgb> } = {},
  ) => {
    page.drawText(text, {
      x,
      y: yy,
      size: opts.size ?? 10,
      font: opts.font ?? font,
      color: opts.color ?? black,
    });
  };

  // Header
  draw("OFFERTE", marginX, y, { size: 20, font: bold });
  const installer = input.installer ?? null;

  // Right-side company block (fallback: skip missing fields)
  const rightLines: { text: string; size: number; font: typeof font; color: ReturnType<typeof rgb> }[] = [];
  if (installer?.company) rightLines.push({ text: installer.company, size: 14, font: bold, color: black });
  if (installer?.name) rightLines.push({ text: installer.name, size: 10, font, color: gray });
  if (installer?.address) {
    for (const line of installer.address.split("\n").map((l) => l.trim()).filter(Boolean)) {
      rightLines.push({ text: line.slice(0, 60), size: 9, font, color: gray });
    }
  }
  if (installer?.vat_number) rightLines.push({ text: `BTW: ${installer.vat_number}`, size: 9, font, color: gray });

  let ry = y;
  for (const l of rightLines) {
    const w = l.font.widthOfTextAtSize(l.text, l.size);
    draw(l.text, width - marginX - w, ry, { size: l.size, font: l.font, color: l.color });
    ry -= l.size + 2;
  }

  y -= 20;
  draw(input.quoteNumber, marginX, y, { size: 10, color: gray });
  y -= 12;
  draw(`Datum: ${new Date(input.createdAt).toLocaleDateString("nl-BE")}`, marginX, y, { color: gray });
  y = Math.min(y - 18, ry - 10);

  // Customer
  if (input.customer) {
    page.drawLine({ start: { x: marginX, y }, end: { x: width - marginX, y }, thickness: 1, color: black });
    y -= 16;
    draw("KLANT", marginX, y, { size: 8, font: bold, color: gray });
    y -= 14;
    draw(input.customer.name, marginX, y, { font: bold });
    y -= 12;
    if (input.customer.company) {
      draw(input.customer.company, marginX, y);
      y -= 12;
    }
    if (input.customer.address) {
      draw(input.customer.address, marginX, y);
      y -= 12;
    }
    draw(input.customer.email, marginX, y);
    y -= 14;
    page.drawLine({ start: { x: marginX, y }, end: { x: width - marginX, y }, thickness: 1, color: black });
    y -= 20;
  }

  // Project
  if (input.project) {
    draw("PROJECT", marginX, y, { size: 8, font: bold, color: gray });
    y -= 14;
    draw(input.project.title, marginX, y, { font: bold });
    y -= 12;
    if (input.project.description) {
      draw(input.project.description.slice(0, 120), marginX, y);
      y -= 12;
    }
    y -= 12;
  }

  // Table header
  const colX = { desc: marginX, qty: 300, price: 410, total: 500 };
  page.drawLine({ start: { x: marginX, y: y + 4 }, end: { x: width - marginX, y: y + 4 }, thickness: 1.5, color: black });
  draw("Omschrijving", colX.desc, y - 10, { font: bold, size: 9 });
  draw("Hoeveelheid", colX.qty, y - 10, { font: bold, size: 9 });
  draw("Prijs", colX.price, y - 10, { font: bold, size: 9 });
  draw("Totaal", colX.total, y - 10, { font: bold, size: 9 });

  y -= 16;
  page.drawLine({ start: { x: marginX, y: y - 2 }, end: { x: width - marginX, y: y - 2 }, thickness: 0.5, color: black });
  y -= 12;

  for (const it of input.items) {
    if (y < 80) break;
    const unit = it.unit ?? "stuk";
    let qtyLabel = String(it.quantity);
    let priceLabel = eur(Number(it.unit_price));
    if (unit === "oppervlakte") {
      const area = ((it.width_mm ?? 0) * (it.height_mm ?? 0)) / 1_000_000;
      qtyLabel = `${it.quantity} × ${area.toFixed(2)} m²`;
      priceLabel = `${eur(Number(it.unit_price))} / m²`;
    } else if (unit === "lengte") {
      const len = (it.width_mm ?? 0) / 1000;
      qtyLabel = `${it.quantity} × ${len.toFixed(2)} m`;
      priceLabel = `${eur(Number(it.unit_price))} / m`;
    } else {
      priceLabel = `${eur(Number(it.unit_price))} / stuk`;
    }
    const desc = it.description.length > 60 ? it.description.slice(0, 57) + "..." : it.description;
    draw(desc, colX.desc, y);
    draw(qtyLabel, colX.qty, y);
    draw(priceLabel, colX.price, y);
    draw(eur(Number(it.total_price)), colX.total, y);
    page.drawLine({ start: { x: marginX, y: y - 4 }, end: { x: width - marginX, y: y - 4 }, thickness: 0.3, color: gray });
    y -= 16;
  }


  y -= 8;
  page.drawLine({ start: { x: marginX, y: y + 4 }, end: { x: width - marginX, y: y + 4 }, thickness: 1.5, color: black });
  y -= 14;
  const subtotal = Number(input.totalPrice);
  const vatRate = Number(input.installer?.vat_rate ?? 21);
  const vatAmount = subtotal * (vatRate / 100);
  const totalIncl = subtotal + vatAmount;
  draw("Subtotaal", colX.price, y);
  draw(eur(subtotal), colX.total, y);
  y -= 14;
  draw(`BTW (${vatRate}%)`, colX.price, y);
  draw(eur(vatAmount), colX.total, y);
  y -= 14;
  page.drawLine({ start: { x: colX.price - 10, y: y + 8 }, end: { x: width - marginX, y: y + 8 }, thickness: 0.5, color: black });
  draw("Totaal incl. BTW", colX.price, y, { font: bold });
  draw(eur(totalIncl), colX.total, y, { font: bold });


  y -= 30;
  const termsText =
    (input.installer?.terms && input.installer.terms.trim()) ||
    "Deze offerte is geldig gedurende 30 dagen na uitgifte. Prijzen zijn exclusief btw tenzij anders vermeld. Betaling: 30% voorschot bij bestelling, saldo bij oplevering.";

  const termsGray = rgb(0.4, 0.4, 0.4);
  draw("ALGEMENE VOORWAARDEN", marginX, y, { size: 9, font: bold, color: termsGray });
  y -= 14;

  const maxWidth = width - 2 * marginX;
  const wrapLine = (line: string, size: number): string[] => {
    const words = line.split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (font.widthOfTextAtSize(test, size) > maxWidth) {
        if (cur) lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [""];
  };

  const size = 8;
  for (const raw of termsText.split(/\r?\n/)) {
    for (const wrapped of wrapLine(raw, size)) {
      if (y < 40) break;
      draw(wrapped, marginX, y, { size, color: termsGray });
      y -= size + 3;
    }
    if (y < 40) break;
  }

  return await doc.save();
}
