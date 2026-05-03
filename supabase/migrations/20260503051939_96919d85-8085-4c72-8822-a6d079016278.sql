
DROP FUNCTION IF EXISTS public.resync_projects_planned_dates();

CREATE OR REPLACE FUNCTION public.resync_projects_planned_dates()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_min DATE;
  v_max DATE;
  v_count INTEGER := 0;
  v_changed_total INTEGER := 0;
BEGIN
  FOR r IN
    SELECT id, planned_start_date, planned_end_date
    FROM public.projects
  LOOP
    SELECT MIN(planned_start), MAX(planned_end), COUNT(*)
      INTO v_min, v_max, v_count
    FROM public.project_activities
    WHERE project_id = r.id
      AND planned_start IS NOT NULL
      AND planned_end IS NOT NULL
      AND planned_end >= planned_start;

    IF v_count > 0
       AND (r.planned_start_date IS DISTINCT FROM v_min
            OR r.planned_end_date IS DISTINCT FROM v_max) THEN
      UPDATE public.projects
         SET planned_start_date = v_min,
             planned_end_date   = v_max,
             updated_at = now()
       WHERE id = r.id;

      INSERT INTO public.project_planned_dates_sync_log (
        project_id, source, trigger_op,
        old_planned_start, old_planned_end,
        new_planned_start, new_planned_end,
        activities_considered, changed
      ) VALUES (
        r.id, 'resync', NULL,
        r.planned_start_date, r.planned_end_date,
        v_min, v_max,
        v_count, true
      );

      v_changed_total := v_changed_total + 1;
    END IF;
  END LOOP;

  RETURN v_changed_total;
END;
$$;
