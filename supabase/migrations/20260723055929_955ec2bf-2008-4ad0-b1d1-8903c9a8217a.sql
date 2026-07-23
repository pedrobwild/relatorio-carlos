
-- Onda A2: RPCs de curva S e avanço físico ponderado (staff-only)

CREATE OR REPLACE FUNCTION public.get_project_s_curve_weekly(
  p_project_id uuid,
  p_baseline_id uuid DEFAULT NULL
)
RETURNS TABLE (
  week_start date,
  planned_pct numeric,
  actual_pct numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_baseline_id uuid;
  v_min_date date;
  v_max_date date;
  v_total_weight numeric;
BEGIN
  IF NOT (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), p_project_id)) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_baseline_id := COALESCE(
    p_baseline_id,
    (SELECT id FROM public.schedule_baselines
      WHERE project_id = p_project_id AND is_current
      ORDER BY created_at DESC LIMIT 1)
  );

  IF v_baseline_id IS NULL THEN
    RETURN;
  END IF;

  SELECT SUM(weight) INTO v_total_weight
  FROM public.schedule_baseline_activities
  WHERE baseline_id = v_baseline_id;

  IF v_total_weight IS NULL OR v_total_weight = 0 THEN
    RETURN;
  END IF;

  SELECT MIN(planned_start), GREATEST(MAX(planned_end), CURRENT_DATE)
    INTO v_min_date, v_max_date
  FROM public.schedule_baseline_activities
  WHERE baseline_id = v_baseline_id;

  RETURN QUERY
  WITH weeks AS (
    SELECT gs::date AS week_start
    FROM generate_series(
      date_trunc('week', v_min_date)::date,
      date_trunc('week', v_max_date)::date,
      interval '7 days'
    ) AS gs
  ),
  week_bounds AS (
    SELECT week_start, (week_start + 6)::date AS week_end FROM weeks
  ),
  planned AS (
    SELECT
      wb.week_start,
      COALESCE(SUM(
        sba.weight * LEAST(1.0, GREATEST(0.0,
          CASE
            WHEN wb.week_end < sba.planned_start THEN 0
            WHEN wb.week_end >= sba.planned_end THEN 1
            ELSE (wb.week_end - sba.planned_start + 1)::numeric
                 / NULLIF((sba.planned_end - sba.planned_start + 1), 0)::numeric
          END
        ))
      ), 0) / v_total_weight * 100 AS planned_pct
    FROM week_bounds wb
    LEFT JOIN public.schedule_baseline_activities sba
      ON sba.baseline_id = v_baseline_id
    GROUP BY wb.week_start
  ),
  actual AS (
    SELECT
      wb.week_start,
      COALESCE(SUM(sba.weight * COALESCE(m.progress_pct, 0) / 100.0), 0)
        / v_total_weight * 100 AS actual_pct
    FROM week_bounds wb
    LEFT JOIN public.schedule_baseline_activities sba
      ON sba.baseline_id = v_baseline_id AND sba.activity_id IS NOT NULL
    LEFT JOIN LATERAL (
      SELECT progress_pct
      FROM public.activity_progress_measurements apm
      WHERE apm.activity_id = sba.activity_id
        AND apm.measured_on <= wb.week_end
      ORDER BY apm.measured_on DESC, apm.created_at DESC
      LIMIT 1
    ) m ON true
    GROUP BY wb.week_start
  )
  SELECT p.week_start,
         ROUND(p.planned_pct, 2)::numeric AS planned_pct,
         ROUND(a.actual_pct, 2)::numeric AS actual_pct
  FROM planned p
  JOIN actual a USING (week_start)
  ORDER BY p.week_start;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_project_s_curve_weekly(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_project_weighted_progress(
  p_project_id uuid,
  p_baseline_id uuid DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_baseline_id uuid;
  v_total numeric;
  v_result numeric;
BEGIN
  IF NOT (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), p_project_id)) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_baseline_id := COALESCE(
    p_baseline_id,
    (SELECT id FROM public.schedule_baselines
      WHERE project_id = p_project_id AND is_current
      ORDER BY created_at DESC LIMIT 1)
  );

  IF v_baseline_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT SUM(weight) INTO v_total
  FROM public.schedule_baseline_activities
  WHERE baseline_id = v_baseline_id;

  IF COALESCE(v_total, 0) = 0 THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(SUM(
    sba.weight * COALESCE((
      SELECT progress_pct
      FROM public.activity_progress_measurements apm
      WHERE apm.activity_id = sba.activity_id
      ORDER BY apm.measured_on DESC, apm.created_at DESC
      LIMIT 1
    ), 0) / 100.0
  ), 0) / v_total * 100
  INTO v_result
  FROM public.schedule_baseline_activities sba
  WHERE sba.baseline_id = v_baseline_id
    AND sba.activity_id IS NOT NULL;

  RETURN ROUND(v_result, 2);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_project_weighted_progress(uuid, uuid) TO authenticated;
