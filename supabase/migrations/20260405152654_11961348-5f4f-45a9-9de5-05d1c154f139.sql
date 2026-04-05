-- Add integration and project detail columns to projects table
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS external_system TEXT,
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS client_phone TEXT,
  ADD COLUMN IF NOT EXISTS client_email TEXT,
  ADD COLUMN IF NOT EXISTS condominium TEXT,
  ADD COLUMN IF NOT EXISTS neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS property_type TEXT DEFAULT 'Apartamento',
  ADD COLUMN IF NOT EXISTS total_area NUMERIC,
  ADD COLUMN IF NOT EXISTS estimated_duration_weeks INTEGER,
  ADD COLUMN IF NOT EXISTS budget_value NUMERIC,
  ADD COLUMN IF NOT EXISTS budget_code TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS consultora_comercial TEXT;

-- Unique index for external system upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_external_id_system
  ON public.projects (external_id, external_system)
  WHERE external_id IS NOT NULL AND external_system IS NOT NULL;