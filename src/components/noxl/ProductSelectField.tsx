import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductFormDialog, type ProductSaveIntent } from "@/components/noxl/ProductFormDialog";
import { emptyProductForm, type ProductCodeRow, type ProductWriteInput } from "@/lib/product-input";
import { unitSuffix, type UnitDef } from "@/lib/units";

export type SelectableProduct = ProductCodeRow & {
  name: string;
  unit_price: number | string;
  unit?: string | null;
};

type ProductSelectFieldProps = {
  products: readonly SelectableProduct[];
  units: UnitDef[];
  value: string;
  onValueChange: (productId: string) => void;
  canCreate: boolean;
  ownerId: string;
  unitOf: (code: string | null | undefined) => UnitDef;
  onCreate: (value: ProductWriteInput, intent: ProductSaveIntent) => Promise<void>;
};

const currency = new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" });

export function ProductSelectField({
  products,
  units,
  value,
  onValueChange,
  canCreate,
  ownerId,
  unitOf,
  onCreate,
}: ProductSelectFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="grid gap-1.5">
      <label className="text-sm text-muted-foreground">Product</label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          value={value || undefined}
          onValueChange={onValueChange}
          disabled={products.length === 0}
        >
          <SelectTrigger className="min-h-11 sm:flex-1">
            <SelectValue
              placeholder={products.length === 0 ? "Nog geen producten" : "Kies een product"}
            />
          </SelectTrigger>
          <SelectContent>
            {products.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.code ? `${product.code} · ` : ""}
                {product.name} — {currency.format(Number(product.unit_price) || 0)}{" "}
                {unitSuffix(unitOf(product.unit))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canCreate ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 shrink-0"
            onClick={() => setOpen(true)}
          >
            <Plus className="mr-1 h-4 w-4" /> Nieuw product
          </Button>
        ) : null}
      </div>
      {canCreate ? (
        <ProductFormDialog
          open={open}
          onOpenChange={setOpen}
          title="Nieuw product"
          initial={emptyProductForm()}
          products={products}
          ownerId={ownerId}
          units={units}
          showExtendedAction
          onSave={onCreate}
        />
      ) : null}
    </div>
  );
}
