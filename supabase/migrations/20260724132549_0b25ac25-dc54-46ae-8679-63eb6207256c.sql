
CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
BEGIN
  new_number := 'OFF-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((floor(random() * 10000))::int::text, 4, '0');
  RETURN new_number;
END;
$$;

CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_number TEXT NOT NULL UNIQUE DEFAULT public.generate_quote_number(),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  product_type TEXT NOT NULL CHECK (product_type IN ('raam', 'rolluik')),
  width_mm INTEGER NOT NULL CHECK (width_mm > 0),
  height_mm INTEGER NOT NULL CHECK (height_mm > 0),
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 150,
  area_m2 NUMERIC(10,4) GENERATED ALWAYS AS ((width_mm::numeric * height_mm::numeric) / 1000000) STORED,
  total_ex_vat NUMERIC(12,2) GENERATED ALWAYS AS (((width_mm::numeric * height_mm::numeric) / 1000000) * 150) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.quotes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create quotes"
  ON public.quotes FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can view quotes"
  ON public.quotes FOR SELECT
  TO anon, authenticated
  USING (true);
