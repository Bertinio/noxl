import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEFAULT_UNIT_PRICE = 150;

const quoteItemSchema = z.object({
  product_type: z.enum(["raam", "rolluik"]),
  width_mm: z.number().int().positive().max(20000),
  height_mm: z.number().int().positive().max(20000),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const quoteInputSchema = z.object({
  customer_name: z.string().trim().min(1).max(200),
  customer_email: z.string().trim().email().max(255),
  notes: z.string().trim().max(2000).optional().nullable(),
  items: z.array(quoteItemSchema).min(1).max(50),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getOrCreateUnitPrice(supabase: any, userId: string): Promise<number> {
  const { data } = await supabase
    .from("installer_settings")
    .select("unit_price")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) return Number(data.unit_price);

  const { data: created, error } = await supabase
    .from("installer_settings")
    .insert({ user_id: userId, unit_price: DEFAULT_UNIT_PRICE })
    .select("unit_price")
    .single();
  if (error || !created) {
    console.error("[installer_settings] auto-create failed", error);
    return DEFAULT_UNIT_PRICE;
  }
  return Number(created.unit_price);
}

export const getMySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const unit_price = await getOrCreateUnitPrice(supabase as never, userId);
    return { unit_price };
  });

export const updateMyUnitPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ unit_price: z.number().positive().max(100000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("installer_settings")
      .upsert(
        { user_id: userId, unit_price: data.unit_price },
        { onConflict: "user_id" },
      )
      .select("unit_price")
      .single();
    if (error || !row) {
      console.error("[updateMyUnitPrice] failed", error);
      throw new Error(error?.message ?? "Kon prijs niet opslaan");
    }
    return { unit_price: Number(row.unit_price) };
  });

export const createQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => quoteInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const unit_price = await getOrCreateUnitPrice(supabase as never, userId);

    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .insert({
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        notes: data.notes ?? null,
        user_id: userId,
      })
      .select("id, quote_number, created_at")
      .single();

    if (quoteError || !quote) {
      console.error("[createQuote] header insert failed", quoteError);
      throw new Error(quoteError?.message ?? "Kon offerte niet opslaan");
    }

    const itemsPayload = data.items.map((item, idx) => {
      const w = Math.round(item.width_mm);
      const h = Math.round(item.height_mm);
      const area_m2 = Number(((w * h) / 1_000_000).toFixed(4));
      const total_ex_vat = Number((area_m2 * unit_price).toFixed(2));
      return {
        quote_id: quote.id,
        position: idx + 1,
        product_type: item.product_type,
        width_mm: w,
        height_mm: h,
        unit_price,
        area_m2,
        total_ex_vat,
        notes: item.notes ?? null,
      };
    });

    const { data: items, error: itemsError } = await supabase
      .from("quote_items")
      .insert(itemsPayload)
      .select("id, position, product_type, width_mm, height_mm, area_m2, total_ex_vat, unit_price");

    if (itemsError) {
      console.error("[createQuote] items insert failed", itemsError);
      throw new Error(itemsError.message);
    }

    const total = (items ?? []).reduce(
      (sum, i) => sum + Number(i.total_ex_vat ?? 0),
      0,
    );

    return {
      id: quote.id,
      quote_number: quote.quote_number,
      created_at: quote.created_at,
      items: items ?? [],
      total_ex_vat: total,
      unit_price,
    };
  });

export const listMyQuotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("quotes")
      .select(
        "id, quote_number, customer_name, customer_email, created_at, quote_items(id, product_type, width_mm, height_mm, area_m2, total_ex_vat, position, unit_price)",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
