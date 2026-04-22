-- 1) Add self-referential parent column to support micro-stages (sub-activities)
ALTER TABLE public.project_activities
  ADD COLUMN IF NOT EXISTS parent_activity_id uuid NULL
    REFERENCES public.project_activities(id) ON DELETE CASCADE;

-- Helpful index for lookups by parent (children of a given activity)
CREATE INDEX IF NOT EXISTS idx_project_activities_parent
  ON public.project_activities(parent_activity_id)
  WHERE parent_activity_id IS NOT NULL;

-- Safety: parent must belong to the same project (validation trigger,
-- following the project rule of using triggers instead of CHECK constraints
-- that reference other rows).
CREATE OR REPLACE FUNCTION public.validate_project_activity_parent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_project uuid;
BEGIN
  IF NEW.parent_activity_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_activity_id = NEW.id THEN
    RAISE EXCEPTION 'Uma atividade não pode ser pai dela mesma';
  END IF;

  SELECT project_id INTO v_parent_project
  FROM public.project_activities
  WHERE id = NEW.parent_activity_id;

  IF v_parent_project IS NULL THEN
    RAISE EXCEPTION 'Atividade-pai % não encontrada', NEW.parent_activity_id;
  END IF;

  IF v_parent_project IS DISTINCT FROM NEW.project_id THEN
    RAISE EXCEPTION 'A atividade-pai deve pertencer ao mesmo projeto';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_project_activity_parent ON public.project_activities;
CREATE TRIGGER trg_validate_project_activity_parent
  BEFORE INSERT OR UPDATE OF parent_activity_id, project_id
  ON public.project_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_project_activity_parent();

-- 2) Update replace_project_activities so that the bulk-replace operation
--    preserves the parent_activity_id field. Existing callers that don't send
--    the field continue to work (defaults to NULL).
CREATE OR REPLACE FUNCTION public.replace_project_activities(p_project_id uuid, p_rows jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from public.project_activities where project_id = p_project_id;
  insert into public.project_activities (
    project_id, description, planned_start, planned_end,
    actual_start, actual_end, weight, sort_order, created_by,
    predecessor_ids, etapa, detailed_description, parent_activity_id
  )
  select
    p_project_id,
    (r->>'description')::text,
    (r->>'planned_start')::date,
    (r->>'planned_end')::date,
    nullif(r->>'actual_start','')::date,
    nullif(r->>'actual_end','')::date,
    (r->>'weight')::numeric,
    (r->>'sort_order')::int,
    (r->>'created_by')::uuid,
    coalesce(
      (select array_agg(elem::uuid) from jsonb_array_elements_text(coalesce(r->'predecessor_ids', '[]'::jsonb)) elem),
      '{}'::uuid[]
    ),
    nullif(r->>'etapa',''),
    nullif(btrim(r->>'detailed_description'),''),
    nullif(r->>'parent_activity_id','')::uuid
  from jsonb_array_elements(p_rows) r;
end;
$function$;