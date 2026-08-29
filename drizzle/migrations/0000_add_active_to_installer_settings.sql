ALTER TABLE public.installer_settings
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;