
CREATE TABLE public.installer_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_price numeric NOT NULL DEFAULT 150 CHECK (unit_price > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.installer_settings TO authenticated;
GRANT ALL ON public.installer_settings TO service_role;

ALTER TABLE public.installer_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own settings" ON public.installer_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own settings" ON public.installer_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own settings" ON public.installer_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER installer_settings_set_updated_at
  BEFORE UPDATE ON public.installer_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
