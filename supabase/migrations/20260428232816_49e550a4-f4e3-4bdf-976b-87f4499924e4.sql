-- Add soft delete column
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_projects_deleted_at
  ON public.projects (deleted_at)
  WHERE deleted_at IS NULL;

-- Soft delete function
CREATE OR REPLACE FUNCTION public.soft_delete_project(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.can_manage_project(auth.uid(), p_project_id)) THEN
    RAISE EXCEPTION 'Sem permissão para excluir esta obra';
  END IF;

  UPDATE public.projects
    SET deleted_at = now(),
        updated_at = now()
  WHERE id = p_project_id
    AND deleted_at IS NULL;
END;
$$;

-- Restore function
CREATE OR REPLACE FUNCTION public.restore_project(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.can_manage_project(auth.uid(), p_project_id)) THEN
    RAISE EXCEPTION 'Sem permissão para restaurar esta obra';
  END IF;

  UPDATE public.projects
    SET deleted_at = NULL,
        updated_at = now()
  WHERE id = p_project_id
    AND deleted_at IS NOT NULL;
END;
$$;

-- Hard delete (admin only) for definitive removal
CREATE OR REPLACE FUNCTION public.hard_delete_project(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente admins podem excluir definitivamente uma obra';
  END IF;

  DELETE FROM public.projects WHERE id = p_project_id;
END;
$$;