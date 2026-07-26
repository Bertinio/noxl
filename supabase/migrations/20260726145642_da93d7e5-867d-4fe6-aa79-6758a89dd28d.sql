ALTER TABLE public.products
  ADD COLUMN unit text NOT NULL DEFAULT 'stuk'
  CHECK (unit IN ('stuk', 'lengte', 'oppervlakte'));

ALTER TABLE public.configurations
  ADD COLUMN unit text NOT NULL DEFAULT 'stuk'
  CHECK (unit IN ('stuk', 'lengte', 'oppervlakte'));

ALTER TABLE public.project_quote_items
  ADD COLUMN unit text NOT NULL DEFAULT 'stuk'
  CHECK (unit IN ('stuk', 'lengte', 'oppervlakte'));