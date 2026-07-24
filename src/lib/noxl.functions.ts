import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- role & role-based context ----------
export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (data ?? []).map((r) => r.role as "admin" | "customer");
    // Auto-promote first-time users to admin so anyone signing up becomes an installer
    if (roles.length === 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const admin = (await import("@/integrations/supabase/client.server")) as any;
      await admin.supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });
      return { role: "admin" as const };
    }
    if (roles.includes("admin")) return { role: "admin" as const };
    return { role: "customer" as const };
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
      invite: z.boolean().default(true),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let authUserId: string | null = null;

    if (data.invite) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const admin = (await import("@/integrations/supabase/client.server")) as any;
      // Try to find existing auth user by email, else invite
      const { data: existing } = await admin.supabaseAdmin.auth.admin.listUsers();
      const found = existing?.users?.find(
        (u: { email?: string }) => u.email?.toLowerCase() === data.email.toLowerCase(),
      );
      if (found) {
        authUserId = found.id;
      } else {
        const { data: invited, error: invErr } = await admin.supabaseAdmin.auth.admin.inviteUserByEmail(
          data.email,
        );
        if (invErr) console.error("[invite]", invErr.message);
        authUserId = invited?.user?.id ?? null;
      }
      if (authUserId) {
        await admin.supabaseAdmin
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
    return data ?? [];
  });

export const getProject = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: project, error } = await context.supabase
      .from("projects")
      .select("id, title, description, status, total_price, created_at, customer_id, customers(id, name, email, company, address)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) throw new Error("Project niet gevonden");
    const { data: configs } = await context.supabase
      .from("configurations")
      .select("id, option_name, option_value, quantity, unit_price, total_price, product_id, created_at")
      .eq("project_id", data.id)
      .order("created_at", { ascending: true });
    const { data: quotes } = await context.supabase
      .from("project_quotes")
      .select("id, quote_number, total_price, created_at")
      .eq("project_id", data.id)
      .order("created_at", { ascending: false });
    return { project, configurations: configs ?? [], quotes: quotes ?? [] };
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

// ---------- products ----------
const productInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  unit_price: z.number().min(0).max(1_000_000),
  category: z.string().trim().max(100).optional().nullable(),
});

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("products")
      .select("id, name, description, unit_price, category, created_at")
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

// ---------- configurations ----------
const configItemSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid(),
  option_name: z.string().trim().min(1).max(200),
  option_value: z.string().trim().max(500).optional().nullable(),
  quantity: z.number().int().min(0).max(100000),
  unit_price: z.number().min(0).max(1_000_000),
});

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

    if (data.items.length > 0) {
      const payload = data.items.map((it) => ({
        project_id: data.project_id,
        product_id: it.product_id,
        option_name: it.option_name,
        option_value: it.option_value ?? null,
        quantity: it.quantity,
        unit_price: it.unit_price,
        total_price: Number((it.quantity * it.unit_price).toFixed(2)),
      }));
      const { error: insErr } = await supabase.from("configurations").insert(payload);
      if (insErr) throw new Error(insErr.message);
    }

    const total = data.items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
    const status = data.items.length > 0 ? "configured" : "draft";
    const { error: upErr } = await supabase
      .from("projects")
      .update({ total_price: Number(total.toFixed(2)), status })
      .eq("id", data.project_id);
    if (upErr) throw new Error(upErr.message);

    return { total_price: Number(total.toFixed(2)), count: data.items.length };
  });

// ---------- quotes ----------
export const generateQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ project_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: configs, error: cErr } = await supabase
      .from("configurations")
      .select("option_name, option_value, quantity, unit_price, total_price")
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
      description:
        c.option_name + (c.option_value ? ` — ${c.option_value}` : ""),
      quantity: c.quantity,
      unit_price: Number(c.unit_price),
      total_price: Number(c.total_price ?? 0),
    }));
    const { error: iErr } = await supabase.from("project_quote_items").insert(items);
    if (iErr) throw new Error(iErr.message);

    return { id: quote.id, quote_number: quote.quote_number };
  });

export const getQuote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: quote, error } = await context.supabase
      .from("project_quotes")
      .select("id, quote_number, total_price, created_at, project_id, projects(id, title, description, customers(name, email, company, address))")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!quote) throw new Error("Offerte niet gevonden");
    const { data: items } = await context.supabase
      .from("project_quote_items")
      .select("id, description, quantity, unit_price, total_price")
      .eq("quote_id", data.id)
      .order("created_at", { ascending: true });
    return { quote, items: items ?? [] };
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
