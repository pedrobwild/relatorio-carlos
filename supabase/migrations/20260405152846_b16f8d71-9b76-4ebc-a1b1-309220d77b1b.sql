ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS external_system TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fornecedores_external_id_system
  ON public.fornecedores (external_id, external_system)
  WHERE external_id IS NOT NULL AND external_system IS NOT NULL;