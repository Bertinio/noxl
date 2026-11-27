import { z } from "zod";

const productCodePattern = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const unitCodePattern = /^[a-z0-9_-]+$/;

export const productWriteSchema = z.object({
  name: z.string().trim().min(1, "Productnaam is verplicht").max(200),
  code: z
    .string()
    .trim()
    .min(1, "Productcode is verplicht")
    .max(80, "Productcode is te lang")
    .regex(productCodePattern, "Productcode mag alleen letters, cijfers en . _ - / bevatten"),
  description: z.string().trim().max(2000).nullish(),
  unit_price: z.number().min(0, "Basisprijs mag niet negatief zijn").max(1_000_000),
  category: z.string().trim().max(100).nullish(),
  manufacturer: z.string().trim().max(200).nullish(),
  unit: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(unitCodePattern, "Ongeldige eenheid")
    .default("stuk"),
});

export type ProductWriteInput = z.infer<typeof productWriteSchema>;

export type ProductFormState = {
  name: string;
  code: string;
  category: string;
  manufacturer: string;
  description: string;
  unit_price: string;
  unit: string;
};

export const emptyProductForm = (): ProductFormState => ({
  name: "",
  code: "",
  category: "",
  manufacturer: "",
  description: "",
  unit_price: "0",
  unit: "stuk",
});

export type ProductCodeRow = {
  id: string;
  owner_id?: string | null;
  code: string | null;
};

export function canCreateProducts(role: string | null | undefined): boolean {
  return role === "admin" || role === "installer";
}

export function assertCanCreateProducts(roles: readonly string[]): void {
  if (!roles.includes("admin") && !roles.includes("installer")) {
    throw new Error("Je hebt geen recht om producten aan te maken");
  }
}

export function hasDuplicateProductCode(
  products: readonly ProductCodeRow[],
  code: string,
  ownerId: string,
  exceptId?: string,
): boolean {
  const needle = code.trim().toLowerCase();
  if (!needle) return false;
  return products.some((product) => {
    if (exceptId && product.id === exceptId) return false;
    if (product.owner_id != null && product.owner_id !== ownerId) return false;
    return (product.code ?? "").trim().toLowerCase() === needle;
  });
}

export function productWriteError(message: string): string {
  if (message.includes("products_owner_code_unique")) return "Deze productcode bestaat al";
  if (message.includes("products_owner_name_unique"))
    return "Er bestaat al een product met deze naam";
  if (/code|manufacturer/i.test(message) && /does not exist|schema cache/i.test(message)) {
    return "Productcode kan nog niet worden opgeslagen. Voer eerst de database-migratie uit.";
  }
  return message;
}

export function buildProductFields(input: ProductWriteInput) {
  return {
    name: input.name,
    code: input.code,
    description: input.description?.trim() ? input.description.trim() : null,
    unit_price: input.unit_price,
    category: input.category?.trim() ? input.category.trim() : null,
    manufacturer: input.manufacturer?.trim() ? input.manufacturer.trim() : null,
    unit: input.unit,
  };
}

export function buildProductInsert(userId: string, input: ProductWriteInput) {
  return {
    owner_id: userId,
    ...buildProductFields(input),
  };
}

export function applyCreatedProduct<
  T extends {
    product_id: string;
    option_name: string;
    option_value: string;
    unit_price: number;
    unit: string;
  },
>(
  row: T,
  product: {
    id: string;
    name: string;
    description: string | null;
    unit_price: number | string;
    unit: string | null;
  },
): T {
  return {
    ...row,
    product_id: product.id,
    option_name: product.name,
    option_value: row.option_value.trim() ? row.option_value : (product.description ?? ""),
    unit_price: Number(product.unit_price) || 0,
    unit: product.unit ?? row.unit,
  };
}

export function productToForm(product: {
  name: string;
  code?: string | null;
  category?: string | null;
  manufacturer?: string | null;
  description?: string | null;
  unit_price: number | string;
  unit?: string | null;
}): ProductFormState {
  return {
    name: product.name,
    code: product.code ?? "",
    category: product.category ?? "",
    manufacturer: product.manufacturer ?? "",
    description: product.description ?? "",
    unit_price: String(Number(product.unit_price) || 0),
    unit: product.unit ?? "stuk",
  };
}

export function validateProductForm(
  form: ProductFormState,
  products: readonly ProductCodeRow[],
  ownerId: string,
  exceptId?: string,
): { ok: true; value: ProductWriteInput } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const priceRaw = form.unit_price.trim().replace(",", ".");
  const price = priceRaw === "" ? Number.NaN : Number(priceRaw);

  if (priceRaw === "") errors.unit_price = "Basisprijs is verplicht";
  else if (!Number.isFinite(price)) errors.unit_price = "Basisprijs is ongeldig";

  const parsed = productWriteSchema.safeParse({
    name: form.name,
    code: form.code,
    category: form.category.trim() ? form.category : null,
    manufacturer: form.manufacturer.trim() ? form.manufacturer : null,
    description: form.description.trim() ? form.description : null,
    unit_price: Number.isFinite(price) ? price : 0,
    unit: form.unit || "stuk",
  });

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!errors[key]) errors[key] = issue.message;
    }
  }

  const codeToCheck = parsed.success ? parsed.data.code : form.code;
  if (
    !errors.code &&
    codeToCheck.trim() &&
    hasDuplicateProductCode(products, codeToCheck, ownerId, exceptId)
  ) {
    errors.code = "Deze productcode bestaat al";
  }

  if (Object.keys(errors).length > 0 || !parsed.success) {
    return { ok: false, errors };
  }
  return { ok: true, value: parsed.data };
}
