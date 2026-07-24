
-- Restructure quotes to header-only, add quote_items for line items
ALTER TABLE public.quotes DROP COLUMN IF EXISTS total_ex_vat;
ALTER TABLE public.quotes DROP COLUMN IF EXISTS area_m2;
ALTER TABLE public.quotes DROP COLUMN IF EXISTS product_type;
ALTER TABLE public.quotes DROP COLUMN IF EXISTS width_mm;
ALTER TABLE public.quotes DROP COLUMN IF EXISTS height_mm;
ALTER TABLE public.quotes DROP COLUMN IF EXISTS unit_price;

CREATE TABLE public.quote_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 1,
  product_type TEXT NOT NULL CHECK (product_type IN ('raam', 'rolluik')),
  width_mm INTEGER NOT NULL CHECK (width_mm > 0),
  height_mm INTEGER NOT NULL CHECK (height_mm > 0),
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 150,
  area_m2 NUMERIC(10,4) GENERATED ALWAYS AS ((width_mm::numeric * height_mm::numeric) / 1000000) STORED,
  total_ex_vat NUMERIC(12,2) GENERATED ALWAYS AS (((width_mm::numeric * height_mm::numeric) / 1000000) * 150) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX quote_items_quote_id_idx ON public.quote_items(quote_id);

GRANT SELECT, INSERT ON public.quote_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_items TO authenticated;
GRANT ALL ON public.quote_items TO service_role;

ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create quote items"
  ON public.quote_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can view quote items"
  ON public.quote_items FOR SELECT
  TO anon, authenticated
  USING (true);
