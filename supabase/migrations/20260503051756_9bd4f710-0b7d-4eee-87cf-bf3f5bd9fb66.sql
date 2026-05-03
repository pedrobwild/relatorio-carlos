
CREATE OR REPLACE FUNCTION public.resync_projects_planned_dates()
RETURNS TABLE(updated_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH valid_activities AS (
    SELECT project_id,
           MIN(planned_start) AS min_start,
           MAX(planned_end)   AS max_end
      FROM public.project_activities
     WHERE planned_start IS NOT NULL
       AND planned_end   IS NOT NULL
       AND planned_end  >= planned_start
     GROUP BY project_id
  ),
  updated AS (
    UPDATE public.projects p
       SET planned_start_date = a.min_start,
           planned_end_date   = a.max_end,
           updated_at         = now()
      FROM valid_activities a
     WHERE a.project_id = p.id
       AND (p.planned_start_date IS DISTINCT FROM a.min_start
            OR p.planned_end_date IS DISTINCT FROM a.max_end)
     RETURNING p.id
  )
  SELECT COUNT(*)::int INTO v_count FROM updated;

  RETURN QUERY SELECT v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.resync_projects_planned_dates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resync_projects_planned_dates() TO service_role;
