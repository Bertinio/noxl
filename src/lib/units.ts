// Shared (browser-safe) helpers for unit-based pricing.
export type UnitBasis = "stuk" | "lengte" | "oppervlakte";

export type UnitDef = {
  id?: string;
  owner_id?: string | null;
  code: string;
  label: string;
  symbol: string;
  basis: UnitBasis;
  active?: boolean;
};

export const UNIT_BASES: { value: UnitBasis; label: string; hint: string }[] = [
  { value: "stuk", label: "Per stuk", hint: "prijs × aantal" },
  { value: "lengte", label: "Per meter (lengte)", hint: "lengte in m × prijs × aantal" },
  { value: "oppervlakte", label: "Per m² (oppervlakte)", hint: "breedte × hoogte × prijs × aantal" },
];

export const FALLBACK_UNIT: UnitDef = {
  code: "stuk",
  label: "Stuk",
  symbol: "stuk",
  basis: "stuk",
  active: true,
};

export function isUnitBasis(v: unknown): v is UnitBasis {
  return v === "stuk" || v === "lengte" || v === "oppervlakte";
}

/** Resolve a stored unit code against the available units; never throws. */
export function resolveUnit(units: UnitDef[] | undefined | null, code: string | null | undefined): UnitDef {
  if (!code) return FALLBACK_UNIT;
  const found = (units ?? []).find((u) => u.code === code);
  if (found) return { ...found, basis: isUnitBasis(found.basis) ? found.basis : "stuk" };
  if (isUnitBasis(code)) {
    return { code, label: code, symbol: code === "lengte" ? "m" : code === "oppervlakte" ? "m²" : "stuk", basis: code };
  }
  return FALLBACK_UNIT;
}

export function unitSuffix(unit: UnitDef): string {
  return `/ ${unit.symbol}`;
}

export type PriceRow = {
  width_mm: number;
  height_mm: number;
  quantity: number;
  unit_price: number;
};

export function computeLineTotal(basis: UnitBasis, r: PriceRow): number {
  const qty = r.quantity || 0;
  if (basis === "oppervlakte") return ((r.width_mm * r.height_mm) / 1_000_000) * r.unit_price * qty;
  if (basis === "lengte") return (r.width_mm / 1000) * r.unit_price * qty;
  return qty * r.unit_price;
}

const num = new Intl.NumberFormat("nl-BE", { maximumFractionDigits: 3 });

export function metricsLabel(unit: UnitDef, r: PriceRow): string {
  if (unit.basis === "oppervlakte") return `${num.format((r.width_mm * r.height_mm) / 1_000_000)} m²`;
  if (unit.basis === "lengte") return `${num.format(r.width_mm / 1000)} m`;
  return `${r.quantity} ${unit.symbol}`;
}
