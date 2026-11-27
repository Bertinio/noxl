import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  emptyProductForm,
  validateProductForm,
  type ProductCodeRow,
  type ProductFormState,
  type ProductWriteInput,
} from "@/lib/product-input";
import type { UnitDef } from "@/lib/units";

export type ProductSaveIntent = "save" | "edit-full";

type ProductFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initial: ProductFormState;
  products: readonly ProductCodeRow[];
  ownerId: string;
  exceptId?: string;
  units?: UnitDef[];
  showUnit?: boolean;
  showExtendedAction?: boolean;
  pending?: boolean;
  onSave: (value: ProductWriteInput, intent: ProductSaveIntent) => Promise<void>;
};

export function ProductFormDialog({
  open,
  onOpenChange,
  title,
  initial,
  products,
  ownerId,
  exceptId,
  units = [],
  showUnit = false,
  showExtendedAction = false,
  pending = false,
  onSave,
}: ProductFormDialogProps) {
  const [form, setForm] = useState<ProductFormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<ProductSaveIntent | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setForm(initial);
      setErrors({});
    }
    wasOpen.current = open;
  }, [open, initial]);

  function setField<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function submit(intent: ProductSaveIntent) {
    const result = validateProductForm(form, products, ownerId, exceptId);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setSaving(intent);
    try {
      await onSave(result.value, intent);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kon product niet opslaan");
    } finally {
      setSaving(null);
    }
  }

  const busy = pending || saving !== null;
  const activeUnits = units.filter((unit) => unit.active !== false);

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Productnaam" error={errors.name}>
            <Input
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field label="Productcode" error={errors.code}>
            <Input
              value={form.code}
              onChange={(event) => setField("code", event.target.value)}
              placeholder="bv. RAM-100"
              autoComplete="off"
            />
          </Field>
          <Field label="Productgroep" error={errors.category}>
            <Input
              value={form.category}
              onChange={(event) => setField("category", event.target.value)}
              placeholder="bv. Raam, Rolluik"
            />
          </Field>
          <Field label="Basisprijs (€)" error={errors.unit_price}>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.unit_price}
              onChange={(event) => setField("unit_price", event.target.value)}
            />
          </Field>
          <Field label="Fabrikant" error={errors.manufacturer}>
            <Input
              value={form.manufacturer}
              onChange={(event) => setField("manufacturer", event.target.value)}
              placeholder="Naam van de fabrikant"
            />
          </Field>
          <Field label="Korte omschrijving" error={errors.description}>
            <Textarea
              value={form.description}
              onChange={(event) => setField("description", event.target.value)}
              rows={3}
            />
          </Field>
          {showUnit ? (
            <Field label="Eenheid" error={errors.unit}>
              <Select value={form.unit} onValueChange={(value) => setField("unit", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activeUnits.map((unit) => (
                    <SelectItem key={unit.code} value={unit.code}>
                      {unit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Annuleren
          </Button>
          {showExtendedAction ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => submit("edit-full")}
              disabled={busy}
            >
              {saving === "edit-full" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Opslaan en uitgebreid bewerken
            </Button>
          ) : null}
          <Button type="button" onClick={() => submit("save")} disabled={busy}>
            {saving === "save" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Opslaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export { emptyProductForm };
