ALTER TABLE public.non_conformities
  ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS actual_cost NUMERIC(12,2);