ALTER TABLE public.non_conformities
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS root_cause TEXT;