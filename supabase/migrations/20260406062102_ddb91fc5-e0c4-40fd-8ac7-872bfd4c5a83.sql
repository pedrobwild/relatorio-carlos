-- Add unique constraint for external sync idempotency on orcamentos
CREATE UNIQUE INDEX IF NOT EXISTS idx_orcamentos_external_unique
  ON public.orcamentos (external_id, external_system)
  WHERE external_id IS NOT NULL AND external_system IS NOT NULL;