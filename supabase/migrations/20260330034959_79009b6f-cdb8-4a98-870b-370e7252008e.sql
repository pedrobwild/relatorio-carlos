-- ── Índices de performance (queries mais comuns) ──

CREATE INDEX IF NOT EXISTS idx_inspections_project_id
  ON public.inspections(project_id);

CREATE INDEX IF NOT EXISTS idx_inspections_inspector_id
  ON public.inspections(inspector_id);

CREATE INDEX IF NOT EXISTS idx_inspection_items_inspection_id
  ON public.inspection_items(inspection_id);

CREATE INDEX IF NOT EXISTS idx_nc_project_id
  ON public.non_conformities(project_id);

CREATE INDEX IF NOT EXISTS idx_nc_status
  ON public.non_conformities(status);

CREATE INDEX IF NOT EXISTS idx_nc_inspection_id
  ON public.non_conformities(inspection_id);

CREATE INDEX IF NOT EXISTS idx_nc_responsible_user
  ON public.non_conformities(responsible_user_id) WHERE responsible_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nc_deadline
  ON public.non_conformities(deadline) WHERE deadline IS NOT NULL AND status != 'closed';

CREATE INDEX IF NOT EXISTS idx_nc_history_nc_id
  ON public.nc_history(nc_id);

CREATE INDEX IF NOT EXISTS idx_nc_history_actor_id
  ON public.nc_history(actor_id);

-- ── Foreign Keys de integridade referencial ──

ALTER TABLE public.inspections
  ADD CONSTRAINT fk_inspections_inspector
  FOREIGN KEY (inspector_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.non_conformities
  ADD CONSTRAINT fk_nc_responsible_user
  FOREIGN KEY (responsible_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.non_conformities
  ADD CONSTRAINT fk_nc_created_by
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.nc_history
  ADD CONSTRAINT fk_nc_history_actor
  FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;