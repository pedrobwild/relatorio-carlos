ALTER TABLE public.projects DROP CONSTRAINT projects_status_check;

ALTER TABLE public.projects ADD CONSTRAINT projects_status_check
  CHECK (status = ANY (ARRAY['draft', 'active', 'completed', 'paused', 'cancelled']));