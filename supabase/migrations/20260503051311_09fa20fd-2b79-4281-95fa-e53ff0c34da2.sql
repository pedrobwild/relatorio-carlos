
-- Mantém projects.planned_start_date / planned_end_date em sincronia com
-- o cronograma (MIN/MAX em project_activities). Isso resolve a divergência
-- entre Painel de Obras (lê projects) e Cronograma (calcula por activities).

CREATE OR REPLACE FUNCTION public.sync_project_planned_dates_from_activities()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
  v_min date;
  v_max date;
BEGIN
  v_project_id := COALESCE(NEW.project_id, OLD.project_id);
  IF v_project_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT MIN(planned_start), MAX(planned_end)
    INTO v_min, v_max
  FROM public.project_activities
  WHERE project_id = v_project_id;

  -- Só sobrescreve quando há atividades; preserva valores existentes caso
  -- a obra tenha sido esvaziada (evita zerar datas oficiais por engano).
  IF v_min IS NOT NULL AND v_max IS NOT NULL THEN
    UPDATE public.projects
       SET planned_start_date = v_min,
           planned_end_date   = v_max,
           updated_at         = now()
     WHERE id = v_project_id
       AND (planned_start_date IS DISTINCT FROM v_min
            OR planned_end_date IS DISTINCT FROM v_max);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_project_planned_dates ON public.project_activities;
CREATE TRIGGER trg_sync_project_planned_dates
AFTER INSERT OR UPDATE OF planned_start, planned_end OR DELETE
ON public.project_activities
FOR EACH ROW
EXECUTE FUNCTION public.sync_project_planned_dates_from_activities();

-- Backfill imediato para todas as obras existentes que estão fora de sincronia.
UPDATE public.projects p
   SET planned_start_date = a.min_start,
       planned_end_date   = a.max_end,
       updated_at         = now()
  FROM (
    SELECT project_id,
           MIN(planned_start) AS min_start,
           MAX(planned_end)   AS max_end
      FROM public.project_activities
     GROUP BY project_id
  ) a
 WHERE a.project_id = p.id
   AND a.min_start IS NOT NULL
   AND a.max_end   IS NOT NULL
   AND (p.planned_start_date IS DISTINCT FROM a.min_start
        OR p.planned_end_date IS DISTINCT FROM a.max_end);
