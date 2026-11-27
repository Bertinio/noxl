-- Productcode en fabrikant op de bestaande catalogus.
-- Code is uniek per installateur (owner_id). Bestaande rijen blijven geldig zonder code.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS manufacturer text;

CREATE UNIQUE INDEX IF NOT EXISTS products_owner_code_unique
  ON public.products (owner_id, lower(code))
  WHERE code IS NOT NULL AND btrim(code) <> '';

DROP POLICY IF EXISTS "products_owner_insert" ON public.products;
CREATE POLICY "products_owner_insert" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'installer'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );
