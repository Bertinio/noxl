ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'installer';

ALTER TABLE public.installer_settings 
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS vat_number text;

CREATE OR REPLACE FUNCTION public.handle_new_user_installer_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'installer'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_installer ON auth.users;
CREATE TRIGGER on_auth_user_created_installer
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_installer_role();