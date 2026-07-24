import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type Item = {
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

type QuotePdfInput = {
  quoteNumber: string;
  createdAt: string;
  totalPrice: number;
  customer: { name: string; email: string; company: string | null; address: string | null } | null;
  project: { title: string; description: string | null } | null;
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
  draw("NoXL", width - marginX - 40, y, { size: 14, font: bold });
  y -= 20;
  draw(input.quoteNumber, marginX, y, { size: 10, color: gray });
  draw("Offerte-applicatie", width - marginX - 90, y, { size: 8, color: gray });
  y -= 14;
  draw(`Datum: ${new Date(input.createdAt).toLocaleDateString("nl-BE")}`, marginX, y, { color: gray });
  y -= 30;

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
  const colX = { desc: marginX, qty: 340, price: 400, total: 490 };
  page.drawLine({ start: { x: marginX, y: y + 4 }, end: { x: width - marginX, y: y + 4 }, thickness: 1.5, color: black });
  draw("Omschrijving", colX.desc, y - 10, { font: bold, size: 9 });
  draw("Aantal", colX.qty, y - 10, { font: bold, size: 9 });
  draw("Prijs/stuk", colX.price, y - 10, { font: bold, size: 9 });
  draw("Totaal", colX.total, y - 10, { font: bold, size: 9 });
  y -= 16;
  page.drawLine({ start: { x: marginX, y: y - 2 }, end: { x: width - marginX, y: y - 2 }, thickness: 0.5, color: black });
  y -= 12;

  for (const it of input.items) {
    if (y < 80) break;
    const desc = it.description.length > 60 ? it.description.slice(0, 57) + "..." : it.description;
    draw(desc, colX.desc, y);
    draw(String(it.quantity), colX.qty, y);
    draw(eur(Number(it.unit_price)), colX.price, y);
    draw(eur(Number(it.total_price)), colX.total, y);
    y -= 16;
    page.drawLine({ start: { x: marginX, y: y + 4 }, end: { x: width - marginX, y: y + 4 }, thickness: 0.3, color: gray });
  }

  y -= 8;
  page.drawLine({ start: { x: marginX, y: y + 4 }, end: { x: width - marginX, y: y + 4 }, thickness: 1.5, color: black });
  y -= 14;
  draw("TOTAAL", colX.price, y, { font: bold });
  draw(eur(Number(input.totalPrice)), colX.total, y, { font: bold });

  y -= 40;
  draw(
    "Deze offerte is een indicatie. Prijzen zijn exclusief btw tenzij anders vermeld.",
    marginX,
    y,
    { size: 8, color: gray },
  );

  return await doc.save();
}
