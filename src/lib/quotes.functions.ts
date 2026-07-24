import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const quoteInputSchema = z.object({
  customer_name: z.string().trim().min(1).max(200),
  customer_email: z.string().trim().email().max(255),
  product_type: z.enum(["raam", "rolluik"]),
  width_mm: z.number().int().positive().max(20000),
  height_mm: z.number().int().positive().max(20000),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const createQuote = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => quoteInputSchema.parse(input))
  .handler(async ({ data }) => {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY!;

    const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (supabaseKey.startsWith("sb_") && h.get("Authorization") === `Bearer ${supabaseKey}`) {
            h.delete("Authorization");
          }
          h.set("apikey", supabaseKey);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { data: inserted, error } = await supabase
      .from("quotes")
      .insert({
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        product_type: data.product_type,
        width_mm: data.width_mm,
        height_mm: data.height_mm,
        notes: data.notes ?? null,
      })
      .select("id, quote_number, area_m2, total_ex_vat, created_at")
      .single();

    if (error) {
      console.error("[createQuote] insert failed", error);
      throw new Error(error.message);
    }

    return inserted;
  });
