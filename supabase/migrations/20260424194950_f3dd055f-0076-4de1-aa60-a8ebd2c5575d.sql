ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS painel_external_budget_id text;

COMMENT ON COLUMN public.projects.painel_external_budget_id IS
  'ID do orçamento público no sistema externo Bwild Engine. URL: https://bwildengine.com/admin/budget/{id}';