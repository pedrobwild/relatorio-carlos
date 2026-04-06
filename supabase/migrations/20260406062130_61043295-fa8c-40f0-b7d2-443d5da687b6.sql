-- Drop the partial index (not usable by PostgREST for upsert)
DROP INDEX IF EXISTS idx_orcamentos_external_unique;

-- Create a proper unique constraint
ALTER TABLE public.orcamentos
  ADD CONSTRAINT orcamentos_external_id_external_system_key
  UNIQUE (external_id, external_system);