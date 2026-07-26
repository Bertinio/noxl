import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { one, handleError } from "@/lib/errors";
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
      .select("id, title, description, status, total_price, created_at, customer_id, customers(id, name, email, company, address)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) throw new Error("Project niet gevonden");
    const customer = one(project.customers);
    const { data: configs } = await context.supabase
      .from("configurations")
      .select("id, option_name, option_value, quantity, unit_price, total_price, product_id, width_mm, height_mm, area_m2, created_at")
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
      },
      customer,
      configurations: configs ?? [],
      quotes: quotes ?? [],
    };
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
const unitSchema = z.enum(["stuk", "lengte", "oppervlakte"]);
export type ProductUnit = z.infer<typeof unitSchema>;

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

    const computed = data.items.map((it) => {
      const area = (it.width_mm * it.height_mm) / 1_000_000;
      const line = area * it.unit_price * it.quantity;
      return { it, area, line: Number(line.toFixed(2)) };
    });

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
      .select("option_name, option_value, quantity, unit_price, total_price, product_id, width_mm, height_mm")
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
      .select("id, quote_number, total_price, created_at, project_id, projects(id, title, description, customers(name, email, company, address))")
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
        ? { id: project.id, title: project.title, description: project.description }
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
      role: z.enum(["admin", "customer"]),
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
      role: z.enum(["admin", "customer"]),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    // Guard against removing the last admin so the app can never be locked out.
    if (data.role === "admin") {
      const { supabase } = context;
      const { count } = await supabase
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) <= 1) {
        throw new Error("Kan de laatste beheerder niet verwijderen");
      }
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", data.role);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
