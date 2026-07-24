
-- products catalog
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  description TEXT,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_owner_select" ON public.products FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "products_owner_insert" ON public.products FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "products_owner_update" ON public.products FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "products_owner_delete" ON public.products FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- link configurations & quote items to product
ALTER TABLE public.configurations ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE public.project_quote_items ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

-- remove hardcoded default of 150
ALTER TABLE public.quote_items ALTER COLUMN unit_price DROP DEFAULT;
