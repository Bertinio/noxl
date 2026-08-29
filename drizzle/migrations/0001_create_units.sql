CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  symbol text NOT NULL DEFAULT 'stuk',
  basis text NOT NULL DEFAULT 'stuk' CHECK (basis IN ('stuk','lengte','oppervlakte')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX units_global_code_key ON public.units (code) WHERE owner_id IS NULL;
CREATE UNIQUE INDEX units_owner_code_key ON public.units (owner_id, code) WHERE owner_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO authenticated;
GRANT ALL ON public.units TO service_role;

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

CREATE POLICY units_select ON public.units
  FOR SELECT TO authenticated
  USING (owner_id IS NULL OR owner_id = auth.uid());

CREATE POLICY units_insert_own ON public.units
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY units_update_own ON public.units
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY units_delete_own ON public.units
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY units_admin_global_insert ON public.units
  FOR INSERT TO authenticated
  WITH CHECK (owner_id IS NULL AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY units_admin_global_update ON public.units
  FOR UPDATE TO authenticated
  USING (owner_id IS NULL AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (owner_id IS NULL AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY units_admin_global_delete ON public.units
  FOR DELETE TO authenticated
  USING (owner_id IS NULL AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER units_set_updated_at BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.units (owner_id, code, label, symbol, basis) VALUES
  (NULL, 'stuk', 'Stuk', 'stuk', 'stuk'),
  (NULL, 'lengte', 'Lengte (per meter)', 'm', 'lengte'),
  (NULL, 'oppervlakte', 'Oppervlakte (per m²)', 'm²', 'oppervlakte');
