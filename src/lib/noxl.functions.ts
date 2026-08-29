import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { one, handleError } from "@/lib/errors";
import { computeLineTotal as sharedLineTotal, type UnitBasis } from "@/lib/units";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type SB = SupabaseClient<Database>;
type AppRole = Database["public"]["Enums"]["app_role"];

// Verify the current user has the 'admin' role via the security-definer/invoker
// has_role() function backed by the user_roles table.
async function requireAdmin(supabase: SB, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Alleen beheerders");
}

// ---------- role & role-based context ----------
// NOTE: does NOT auto-promote first-time users to admin. Admin rights must
// be granted explicitly via the user_roles table (see /admin panel).
export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (data ?? []).map((r) => r.role);
    if (roles.includes("admin")) return { role: "admin" as const };
    if (roles.includes("installer")) return { role: "installer" as const };
    if (roles.includes("customer")) return { role: "customer" as const };
    // No role yet (edge case for pre-trigger accounts): treat as installer.
    return { role: "installer" as const };
  });

// ---------- installer settings ----------
const installerSettingsSchema = z.object({
  name: z.string().trim().max(200).optional().nullable(),
  company: z.string().trim().max(200).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  vat_number: z.string().trim().max(50).optional().nullable(),
  terms: z.string().trim().max(10000).optional().nullable(),
  vat_rate: z.union([z.literal(6), z.literal(21)]).optional(),
});


export const getInstallerSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("installer_settings")
      .select("user_id, name, company, address, vat_number, unit_price, terms, vat_rate")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? { user_id: userId, name: null, company: null, address: null, vat_number: null, unit_price: 150, terms: null, vat_rate: 21 };

  });

export const updateInstallerSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => installerSettingsSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("installer_settings")
      .upsert(
        {
          user_id: userId,
          name: data.name ?? null,
          company: data.company ?? null,
          address: data.address ?? null,
          vat_number: data.vat_number ?? null,
          terms: data.terms ?? null,
          ...(data.vat_rate !== undefined ? { vat_rate: data.vat_rate } : {}),
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);

    return { ok: true };
  });

// ---------- customers ----------
export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("customers")
      .select("id, name, email, company, address, auth_user_id, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getCustomer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: c, error } = await context.supabase
      .from("customers")
      .select("id, name, email, company, address, auth_user_id, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!c) throw new Error("Klant niet gevonden");
    const { data: projects } = await context.supabase
      .from("projects")
      .select("id, title, status, total_price, created_at")
      .eq("customer_id", data.id)
      .order("created_at", { ascending: false });
    return { customer: c, projects: projects ?? [] };
  });

export const createCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      name: z.string().trim().min(1).max(200),
      email: z.string().trim().email().max(255),
      company: z.string().trim().max(200).optional().nullable(),
      address: z.string().trim().max(500).optional().nullable(),
      invite: z.boolean().default(false),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let authUserId: string | null = null;

    if (data.invite) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
      const found = existing?.users?.find(
        (u) => u.email?.toLowerCase() === data.email.toLowerCase(),
      );
      if (found) {
        authUserId = found.id;
      } else {
        const { data: invited, error: invErr } =
          await supabaseAdmin.auth.admin.inviteUserByEmail(data.email);
        if (invErr) console.error("[invite]", invErr.message);
        authUserId = invited?.user?.id ?? null;
      }
      if (authUserId) {
        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: authUserId, role: "customer" }, { onConflict: "user_id,role" });
      }
    }

    const { data: row, error } = await supabase
      .from("customers")
      .insert({
        owner_id: userId,
        name: data.name,
        email: data.email,
        company: data.company ?? null,
        address: data.address ?? null,
        auth_user_id: authUserId,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Kon klant niet aanmaken");
    return { id: row.id };
  });

// ---------- projects ----------
export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("projects")
      .select("id, title, status, total_price, created_at, customer_id, customers(name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((p) => {
      const customer = one(p.customers);
      return {
        id: p.id,
        title: p.title,
        status: p.status,
        total_price: p.total_price,
        created_at: p.created_at,
        customer_id: p.customer_id,
        customer_name: customer?.name ?? null,
      };
    });
  });

export const getProject = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: project, error } = await context.supabase
      .from("projects")
      .select("id, title, description, status, total_price, created_at, customer_id, vat_rate, customers(id, name, email, company, address)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) throw new Error("Project niet gevonden");
    const customer = one(project.customers);
    const { data: configs } = await context.supabase
      .from("configurations")
      .select("id, option_name, option_value, quantity, unit_price, total_price, product_id, width_mm, height_mm, area_m2, unit, created_at")
      .eq("project_id", data.id)
      .order("created_at", { ascending: true });
    const { data: quotes } = await context.supabase
      .from("project_quotes")
      .select("id, quote_number, total_price, created_at")
      .eq("project_id", data.id)
      .order("created_at", { ascending: false });
    return {
      project: {
        id: project.id,
        title: project.title,
        description: project.description,
        status: project.status,
        total_price: project.total_price,
        created_at: project.created_at,
        customer_id: project.customer_id,
        vat_rate: Number((project as { vat_rate?: number }).vat_rate ?? 21),
      },
      customer,
      configurations: configs ?? [],
      quotes: quotes ?? [],
    };
  });

export const updateProjectVatRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      vat_rate: z.union([z.literal(6), z.literal(21)]),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("projects")
      .update({ vat_rate: data.vat_rate })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      customer_id: z.string().uuid(),
      title: z.string().trim().min(1).max(200),
      description: z.string().trim().max(2000).optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("projects")
      .insert({
        customer_id: data.customer_id,
        title: data.title,
        description: data.description ?? null,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Kon project niet aanmaken");
    return { id: row.id };
  });

// ---------- units ----------
// Units are managed rows in public.units: global rows (owner_id IS NULL, admin
// managed) plus per-installer rows. Products/configurations store the unit code.
const unitCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(/^[a-z0-9_-]+$/, "Code mag enkel kleine letters, cijfers, - en _ bevatten");

const unitBasisSchema = z.enum(["stuk", "lengte", "oppervlakte"]);

const unitInputSchema = z.object({
  code: unitCodeSchema,
  label: z.string().trim().min(1).max(100),
  symbol: z.string().trim().min(1).max(20),
  basis: unitBasisSchema,
  active: z.boolean().default(true),
  scope: z.enum(["global", "own"]).default("own"),
});

export const listUnits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("units")
      .select("id, owner_id, code, label, symbol, basis, active, created_at")
      .order("owner_id", { ascending: true, nullsFirst: true })
      .order("label", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

async function assertCanManageScope(supabase: SB, userId: string, scope: "global" | "own") {
  if (scope === "global") await requireAdmin(supabase, userId);
}

export const createUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => unitInputSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanManageScope(supabase, userId, data.scope);
    const { data: row, error } = await supabase
      .from("units")
      .insert({
        owner_id: data.scope === "global" ? null : userId,
        code: data.code,
        label: data.label,
        symbol: data.symbol,
        basis: data.basis,
        active: data.active,
      })
      .select("id")
      .single();
    if (error || !row) {
      const dup = error?.code === "23505";
      throw new Error(dup ? "Deze code bestaat al" : (error?.message ?? "Kon eenheid niet aanmaken"));
    }
    return { id: row.id };
  });

export const updateUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    unitInputSchema.omit({ scope: true }).extend({ id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing, error: exErr } = await supabase
      .from("units")
      .select("id, owner_id")
      .eq("id", data.id)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (!existing) throw new Error("Eenheid niet gevonden");
    if (existing.owner_id === null) await requireAdmin(supabase, userId);
    const { error } = await supabase
      .from("units")
      .update({
        code: data.code,
        label: data.label,
        symbol: data.symbol,
        basis: data.basis,
        active: data.active,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.code === "23505" ? "Deze code bestaat al" : error.message);
    return { ok: true };
  });

export const deleteUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing, error: exErr } = await supabase
      .from("units")
      .select("id, owner_id, code")
      .eq("id", data.id)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (!existing) throw new Error("Eenheid niet gevonden");
    if (existing.owner_id === null) await requireAdmin(supabase, userId);
    const { error } = await supabase.from("units").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Map unit codes to their calculation basis for the current user
// (global units + the user's own units).
async function unitBasisMap(supabase: SB): Promise<Record<string, UnitBasis>> {
  const { data } = await supabase.from("units").select("code, basis");
  const map: Record<string, UnitBasis> = {};
  for (const u of data ?? []) {
    if (u.basis === "stuk" || u.basis === "lengte" || u.basis === "oppervlakte") map[u.code] = u.basis;
  }
  return map;
}

// ---------- products ----------
const unitSchema = unitCodeSchema.default("stuk");


const productInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  unit_price: z.number().min(0).max(1_000_000),
  category: z.string().trim().max(100).optional().nullable(),
  unit: unitSchema.default("stuk"),
});

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("products")
      .select("id, name, description, unit_price, category, unit, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => productInputSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("products")
      .insert({
        owner_id: context.userId,
        name: data.name,
        description: data.description ?? null,
        unit_price: data.unit_price,
        category: data.category ?? null,
        unit: data.unit,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Kon product niet aanmaken");
    return { id: row.id };
  });

export const updateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    productInputSchema.extend({ id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("products")
      .update({
        name: data.name,
        description: data.description ?? null,
        unit_price: data.unit_price,
        category: data.category ?? null,
        unit: data.unit,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Bulk import: upsert products by (owner_id, name)
const importRowSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  unit_price: z.number().min(0).max(1_000_000),
  category: z.string().trim().max(100).optional().nullable(),
  unit: unitSchema.default("stuk"),
});

export const importProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ rows: z.array(importRowSchema).min(1).max(5000) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const payload = data.rows.map((r) => ({
      owner_id: context.userId,
      name: r.name,
      description: r.description ?? null,
      unit_price: r.unit_price,
      category: r.category ?? null,
      unit: r.unit,
    }));
    const { error } = await context.supabase
      .from("products")
      .upsert(payload, { onConflict: "owner_id,name" });
    if (error) throw new Error(error.message);
    return { ok: true, count: payload.length };
  });


// ---------- configurations ----------
const configItemSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid(),
  option_name: z.string().trim().min(1).max(200),
  option_value: z.string().trim().max(500).optional().nullable(),
  width_mm: z.number().min(0).max(100000),
  height_mm: z.number().min(0).max(100000),
  quantity: z.number().min(0).max(100000),
  unit_price: z.number().min(0).max(1_000_000),
  unit: unitSchema.default("stuk"),
});

function computeLineTotal(
  it: { width_mm: number; height_mm: number; quantity: number; unit_price: number },
  basis: UnitBasis,
) {
  return sharedLineTotal(basis, it);
}

export const saveConfigurations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      project_id: z.string().uuid(),
      items: z.array(configItemSchema).max(100),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error: delErr } = await supabase
      .from("configurations")
      .delete()
      .eq("project_id", data.project_id);
    if (delErr) throw new Error(delErr.message);

    const bases = await unitBasisMap(supabase);
    const computed = data.items.map((it) => ({
      it,
      line: Number(computeLineTotal(it, bases[it.unit] ?? "stuk").toFixed(2)),
    }));


    if (computed.length > 0) {
      const payload = computed.map(({ it, line }) => ({
        project_id: data.project_id,
        product_id: it.product_id,
        option_name: it.option_name,
        option_value: it.option_value ?? null,
        width_mm: it.width_mm,
        height_mm: it.height_mm,
        quantity: it.quantity,
        unit_price: it.unit_price,
        total_price: line,
        unit: it.unit,
      }));
      const { error: insErr } = await supabase.from("configurations").insert(payload);
      if (insErr) throw new Error(insErr.message);
    }


    const total = computed.reduce((s, c) => s + c.line, 0);
    const status = computed.length > 0 ? "configured" : "draft";
    const { error: upErr } = await supabase
      .from("projects")
      .update({ total_price: Number(total.toFixed(2)), status })
      .eq("id", data.project_id);
    if (upErr) throw new Error(upErr.message);

    return { total_price: Number(total.toFixed(2)), count: computed.length };
  });

// ---------- quotes ----------
export const generateQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ project_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: configs, error: cErr } = await supabase
      .from("configurations")
      .select("option_name, option_value, quantity, unit_price, total_price, product_id, width_mm, height_mm, unit")
      .eq("project_id", data.project_id);
    if (cErr) throw new Error(cErr.message);
    if (!configs || configs.length === 0) throw new Error("Voeg eerst configuratieregels toe");

    const total = configs.reduce((s, c) => s + Number(c.total_price ?? 0), 0);
    const shortId = data.project_id.slice(0, 8);
    const quoteNumber = `Q-${shortId}-${Date.now()}`;

    const { data: quote, error: qErr } = await supabase
      .from("project_quotes")
      .insert({
        project_id: data.project_id,
        quote_number: quoteNumber,
        total_price: Number(total.toFixed(2)),
      })
      .select("id, quote_number")
      .single();
    if (qErr || !quote) throw new Error(qErr?.message ?? "Kon offerte niet aanmaken");

    const items = configs.map((c) => ({
      quote_id: quote.id,
      product_id: c.product_id ?? null,
      description: c.option_name + (c.option_value ? ` — ${c.option_value}` : ""),
      width_mm: c.width_mm,
      height_mm: c.height_mm,
      quantity: c.quantity,
      unit_price: Number(c.unit_price),
      total_price: Number(c.total_price ?? 0),
      unit: c.unit ?? "stuk",
    }));
    const { error: iErr } = await supabase.from("project_quote_items").insert(items);
    if (iErr) throw new Error(iErr.message);


    // Send quote email to customer
    let emailSent = false;
    let emailError: string | null = null;
    try {
      const { sendQuoteEmailWithSupabase } = await import("./quote-email.server");
      const claims = context.claims as { email?: string } | null | undefined;
      const installerName = claims?.email ?? null;
      const result = await sendQuoteEmailWithSupabase(supabase, quote.id, installerName);
      if (result.ok) emailSent = true;
      else emailError = result.reason;
    } catch (e) {
      const handled = handleError(e);
      emailError = handled.message;
    }

    return { id: quote.id, quote_number: quote.quote_number, emailSent, emailError };
  });

export const getQuote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: quote, error } = await context.supabase
      .from("project_quotes")
      .select("id, quote_number, total_price, created_at, project_id, projects(id, title, description, vat_rate, customers(name, email, company, address))")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!quote) throw new Error("Offerte niet gevonden");
    const project = one(quote.projects);
    const customer = project ? one(project.customers) : null;
    const { data: items } = await context.supabase
      .from("project_quote_items")
      .select("id, description, quantity, unit_price, total_price")
      .eq("quote_id", data.id)
      .order("created_at", { ascending: true });
    return {
      quote: {
        id: quote.id,
        quote_number: quote.quote_number,
        total_price: quote.total_price,
        created_at: quote.created_at,
        project_id: quote.project_id,
      },
      project: project
        ? {
            id: project.id,
            title: project.title,
            description: project.description,
            vat_rate: Number((project as { vat_rate?: number }).vat_rate ?? 21),
          }
        : null,
      customer,
      items: items ?? [],
    };
  });


// ---------- resend quote email ----------
export const resendQuoteEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ quote_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { sendQuoteEmailWithSupabase } = await import("./quote-email.server");
    const claims = context.claims as { email?: string } | null | undefined;
    const installerName = claims?.email ?? null;
    const result = await sendQuoteEmailWithSupabase(context.supabase, data.quote_id, installerName);
    if (!result.ok) throw new Error(result.reason);
    return result;
  });

// ---------- customer portal ----------
export const myPortalData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: customer } = await supabase
      .from("customers")
      .select("id, name, email, company, address")
      .eq("auth_user_id", userId)
      .maybeSingle();
    if (!customer) return { customer: null, projects: [], quotes: [] };

    const { data: projects } = await supabase
      .from("projects")
      .select("id, title, status, total_price, created_at")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });

    const projectIds = (projects ?? []).map((p) => p.id);
    let quotes: Array<{ id: string; quote_number: string; total_price: number; created_at: string; project_id: string }> = [];
    if (projectIds.length > 0) {
      const { data: q } = await supabase
        .from("project_quotes")
        .select("id, quote_number, total_price, created_at, project_id")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false });
      quotes = q ?? [];
    }
    return { customer, projects: projects ?? [], quotes };
  });

// ---------- admin panel ----------
export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userList, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) throw new Error(error.message);
    const { data: roles, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rErr) throw new Error(rErr.message);
    const rolesByUser = new Map<string, AppRole[]>();
    for (const r of roles ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    }
    const users = (userList?.users ?? []).map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      roles: rolesByUser.get(u.id) ?? [],
    }));
    return { users };
  });

export const addUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      role: z.enum(["admin", "installer", "customer"]),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: data.user_id, role: data.role },
        { onConflict: "user_id,role" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      role: z.enum(["admin", "installer", "customer"]),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    // Guard against removing the last admin so the app can never be locked out.
    if (data.role === "admin") {
      const total = await countRoleHolders(context.supabase, "admin");
      if (total <= 1) {
        return { ok: false as const, message: "Kan de laatste beheerder niet verwijderen" };
      }
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", data.role);
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const };
  });

// ---------- installer management ----------
const roleSchema = z.enum(["admin", "installer", "customer"]);

async function countRoleHolders(_sb: SB, role: AppRole): Promise<number> {
  // RLS on user_roles restricts SELECT to the caller's own rows, which would
  // undercount holders. Use the admin client to get the real total.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("user_id", { count: "exact", head: true })
    .eq("role", role);
  return count ?? 0;
}

async function computeInstallerStats(sb: SB, installerId: string) {
  // Quotes are attributed to an installer via projects → customers.owner_id.
  const empty = { generated: 0, sent: 0, open: 0, last_quote_at: null as string | null };
  const { data: customers } = await sb
    .from("customers")
    .select("id")
    .eq("owner_id", installerId);
  const custIds = (customers ?? []).map((c) => c.id);
  if (custIds.length === 0) return empty;

  const { data: projects } = await sb
    .from("projects")
    .select("id")
    .in("customer_id", custIds);
  const projIds = (projects ?? []).map((p) => p.id);
  if (projIds.length === 0) return empty;

  const { data: quotes } = await sb
    .from("project_quotes")
    .select("id, created_at, last_email_sent_at")
    .in("project_id", projIds)
    .order("created_at", { ascending: false });
  const rows = quotes ?? [];
  const sent = rows.filter((q) => q.last_email_sent_at !== null).length;

  return {
    generated: rows.length,
    sent,
    open: rows.length - sent,
    last_quote_at: rows[0]?.created_at ?? null,
  };
}


export const listInstallers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: userList, error: uErr } = await supabaseAdmin.auth.admin.listUsers();
    if (uErr) throw new Error(uErr.message);

    const { data: roles, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rErr) throw new Error(rErr.message);
    const rolesByUser = new Map<string, AppRole[]>();
    for (const r of roles ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    }

    // All users are installers or admins — show both in the management list.
    const installerIds = (userList?.users ?? [])
      .filter((u) => {
        const r = rolesByUser.get(u.id) ?? [];
        return r.includes("installer") || r.includes("admin");
      })
      .map((u) => u.id);

    const { data: settings } = await supabaseAdmin
      .from("installer_settings")
      .select("user_id, name, company, active")
      .in("user_id", installerIds.length > 0 ? installerIds : ["00000000-0000-0000-0000-000000000000"]);
    const settingsByUser = new Map(
      (settings ?? []).map((s) => [s.user_id, s] as const),
    );

    const rows = await Promise.all(
      installerIds.map(async (id) => {
        const u = userList!.users.find((x) => x.id === id)!;
        const s = settingsByUser.get(id) ?? null;
        const stats = await computeInstallerStats(supabaseAdmin as unknown as SB, id);
        const banned = Boolean((u as { banned_until?: string | null }).banned_until
          && new Date((u as { banned_until?: string | null }).banned_until as string) > new Date());
        return {
          id: u.id,
          email: u.email ?? "",
          name: s?.name ?? null,
          company: s?.company ?? null,
          roles: rolesByUser.get(u.id) ?? [],
          last_sign_in_at: u.last_sign_in_at ?? null,
          active: (s?.active ?? true) && !banned,
          generated: stats.generated,
          sent: stats.sent,
          open: stats.open,
          last_quote_at: stats.last_quote_at,
        };
      }),
    );


    return { installers: rows };
  });

export const getInstallerStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return await computeInstallerStats(supabaseAdmin as unknown as SB, data.user_id);
  });

export const getInstallerDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: userRes, error: uErr } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    if (uErr) throw new Error(uErr.message);
    const u = userRes?.user;
    if (!u) throw new Error("Gebruiker niet gevonden");

    const { data: rolesRows } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user_id);
    const roles = (rolesRows ?? []).map((r) => r.role);

    const { data: settings } = await supabaseAdmin
      .from("installer_settings")
      .select("name, company, address, vat_number")
      .eq("user_id", data.user_id)
      .maybeSingle();

    const { data: customers } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("owner_id", data.user_id);
    const custIds = (customers ?? []).map((c) => c.id);

    let projectIds: string[] = [];
    if (custIds.length > 0) {
      const { data: projects } = await supabaseAdmin
        .from("projects")
        .select("id")
        .in("customer_id", custIds);
      projectIds = (projects ?? []).map((p) => p.id);
    }

    let generated: Array<{ id: string; quote_number: string; total_price: number; created_at: string; last_email_sent_at: string | null }> = [];
    if (projectIds.length > 0) {
      const { data: qs } = await supabaseAdmin
        .from("project_quotes")
        .select("id, quote_number, total_price, created_at, last_email_sent_at")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false });
      generated = qs ?? [];
    }
    const sent = generated.filter((q) => q.last_email_sent_at !== null);

    return {
      user: {
        id: u.id,
        email: u.email ?? "",
        last_sign_in_at: u.last_sign_in_at ?? null,
        created_at: u.created_at,
      },
      roles,
      settings: settings ?? null,
      generated,
      sent,
      counts: { generated: generated.length, sent: sent.length },
    };
  });

export const addInstaller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ email: z.string().trim().email().max(255) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) throw new Error(error.message);
    const found = list?.users?.find(
      (u) => u.email?.toLowerCase() === data.email.toLowerCase(),
    );
    if (!found) {
      return { ok: false as const, message: "Geen gebruiker gevonden met dit e-mailadres" };
    }
    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: found.id, role: "installer" }, { onConflict: "user_id,role" });
    if (insErr) return { ok: false as const, message: insErr.message };
    return { ok: true as const, user_id: found.id };
  });

export const removeInstaller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const total = await countRoleHolders(context.supabase, "installer");
    if (total <= 1) {
      return { ok: false as const, message: "Kan de laatste installateur niet verwijderen" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", "installer");
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const };
  });

// Overwrite: set the user to exactly one role among admin/installer/customer.
// Overwrite: set the user to exactly one role among admin/installer/customer.
// Only guard: never remove the last admin (app would be locked out).
export const updateUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ user_id: z.string().uuid(), role: roleSchema }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Load current roles for this user
    const { data: current } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user_id);
    const currentRoles = new Set((current ?? []).map((r) => r.role as AppRole));

    // Last-admin guard: block only when removing the admin role and this user
    // is the only admin left.
    if (currentRoles.has("admin") && data.role !== "admin") {
      const adminCount = await countRoleHolders(context.supabase, "admin");
      if (adminCount <= 1) {
        return {
          ok: false as const,
          message: "Kan de laatste beheerder niet verwijderen",
        };
      }
    }

    // Overwrite: delete existing roles, insert the new one
    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id);
    if (delErr) return { ok: false as const, message: delErr.message };

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (insErr) return { ok: false as const, message: insErr.message };

    return { ok: true as const };
  });

// ---------- installer lifecycle (admin only) ----------
const BAN_FOREVER = "876000h"; // ~100 years

// Create a brand-new installer account + profile + role.
export const createInstaller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      email: z.string().trim().email().max(255),
      name: z.string().trim().max(200).optional().nullable(),
      company: z.string().trim().max(200).optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const existing = list?.users?.find(
      (u) => u.email?.toLowerCase() === data.email.toLowerCase(),
    );
    let userId = existing?.id ?? null;

    if (!userId) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        email_confirm: true,
        password: crypto.randomUUID() + "Aa1!",
      });
      if (error) return { ok: false as const, message: error.message };
      userId = created.user?.id ?? null;
      if (!userId) return { ok: false as const, message: "Aanmaken mislukt" };
    }

    const { error: sErr } = await supabaseAdmin
      .from("installer_settings")
      .upsert(
        {
          user_id: userId,
          name: data.name ?? null,
          company: data.company ?? null,
          active: true,
        },
        { onConflict: "user_id" },
      );
    if (sErr) return { ok: false as const, message: sErr.message };

    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "installer" }, { onConflict: "user_id,role" });
    if (rErr) return { ok: false as const, message: rErr.message };

    // Recovery link so the new installer can set a password.
    let link: string | null = null;
    const { data: gen } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
    });
    link = gen?.properties?.action_link ?? null;

    return { ok: true as const, user_id: userId, reset_link: link, existed: Boolean(existing) };
  });

// Activate / deactivate: flips installer_settings.active AND bans the auth user
// so a deactivated installer can no longer sign in.
export const toggleInstallerActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ user_id: z.string().uuid(), active: z.boolean().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("installer_settings")
      .select("active")
      .eq("user_id", data.user_id)
      .maybeSingle();
    const current = row?.active ?? true;
    const next = data.active ?? !current;

    if (!next) {
      // Never lock out the last admin.
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user_id);
      const isAdmin = (roles ?? []).some((r) => r.role === "admin");
      if (isAdmin) {
        const adminCount = await countRoleHolders(context.supabase, "admin");
        if (adminCount <= 1) {
          return { ok: false as const, message: "Kan de laatste beheerder niet deactiveren" };
        }
      }
    }

    const { error: sErr } = await supabaseAdmin
      .from("installer_settings")
      .upsert({ user_id: data.user_id, active: next }, { onConflict: "user_id" });
    if (sErr) return { ok: false as const, message: sErr.message };

    const { error: aErr } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: next ? "none" : BAN_FOREVER,
    });
    if (aErr) return { ok: false as const, message: aErr.message };

    return { ok: true as const, active: next };
  });

// Generate a password-recovery link for an installer. No email is sent from
// the backend; the admin copies the link from the UI.
export const resetInstallerPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: userRes, error: uErr } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    if (uErr) return { ok: false as const, message: uErr.message };
    const email = userRes?.user?.email;
    if (!email) return { ok: false as const, message: "Gebruiker heeft geen e-mailadres" };

    const { data: gen, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
    });
    if (error) return { ok: false as const, message: error.message };
    const link = gen?.properties?.action_link ?? null;
    if (!link) return { ok: false as const, message: "Kon geen reset-link genereren" };
    return { ok: true as const, link, email };
  });

// Robust role switch limited to admin | installer.
export const updateInstallerRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      role: z.enum(["admin", "installer"]),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: current } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user_id);
    const currentRoles = new Set((current ?? []).map((r) => r.role as AppRole));

    if (currentRoles.has("admin") && data.role !== "admin") {
      const adminCount = await countRoleHolders(context.supabase, "admin");
      if (adminCount <= 1) {
        return { ok: false as const, message: "Kan de laatste beheerder niet verwijderen" };
      }
    }

    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id);
    if (delErr) return { ok: false as const, message: delErr.message };

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (insErr) return { ok: false as const, message: insErr.message };

    return { ok: true as const, role: data.role };
  });

// Hard delete: auth user + roles + profile.
export const deleteInstaller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) {
      return { ok: false as const, message: "Je kan je eigen account niet verwijderen" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user_id);
    if ((roles ?? []).some((r) => r.role === "admin")) {
      const adminCount = await countRoleHolders(context.supabase, "admin");
      if (adminCount <= 1) {
        return { ok: false as const, message: "Kan de laatste beheerder niet verwijderen" };
      }
    }

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("installer_settings").delete().eq("user_id", data.user_id);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const };
  });
