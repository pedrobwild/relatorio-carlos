ALTER TABLE public.project_activities
  ADD COLUMN IF NOT EXISTS etapa text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS detailed_description text DEFAULT NULL;