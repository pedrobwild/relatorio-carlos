ALTER TABLE public.project_studio_info
  ADD COLUMN IF NOT EXISTS key_location TEXT,
  ADD COLUMN IF NOT EXISTS electronic_lock_password TEXT,
  ADD COLUMN IF NOT EXISTS provider_access_instructions TEXT;