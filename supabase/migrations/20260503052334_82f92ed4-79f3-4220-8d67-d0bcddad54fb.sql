
CREATE TABLE IF NOT EXISTS public.project_planned_dates_resync_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  projects_total INTEGER NOT NULL DEFAULT 0,
  projects_out_of_sync_before INTEGER NOT NULL DEFAULT 0,
  projects_changed INTEGER NOT NULL DEFAULT 0,
  out_of_sync_ids_before UUID[] NOT NULL DEFAULT '{}',
  changed_ids UUID[] NOT NULL DEFAULT '{}',
  still_out_of_sync_ids_after UUID[] NOT NULL DEFAULT '{}',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pdrr_started
  ON public.project_planned_dates_resync_runs (started_at DESC);

ALTER TABLE public.project_planned_dates_resync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view resync runs"
  ON public.project_planned_dates_resync_runs;
CREATE POLICY "Staff can view resync runs"
  ON public.project_planned_dates_resync_runs
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

DROP FUNCTION IF EXISTS public.resync_projects_planned_dates();

CREATE OR REPLACE FUNCTION public.resync_projects_planned_dates()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id UUID := gen_random_uuid();
  v_started TIMESTAMPTZ := clock_timestamp();
  v_total INTEGER := 0;
  v_out_before UUID[] := '{}';
  v_changed_ids UUID[] := '{}';
  v_still_out UUID[] := '{}';
  v_changed_total INTEGER := 0;
  r RECORD;
  v_min DATE;
  v_max DATE;
  v_count INTEGER := 0;
  v_err TEXT;
BEGIN
  -- Quantidade total de obras
  SELECT COUNT(*) INTO v_total FROM public.projects;

  -- Detecta IDs fora de sincronia ANTES de recalcular
  SELECT COALESCE(array_agg(p.id ORDER BY p.id), '{}')
    INTO v_out_before
  FROM public.projects p
  LEFT JOIN LATERAL (
    SELECT MIN(planned_start) AS mn, MAX(planned_end) AS mx, COUNT(*) AS qt
    FROM public.project_activities a
    WHERE a.project_id = p.id
      AND a.planned_start IS NOT NULL
      AND a.planned_end IS NOT NULL
      AND a.planned_end >= a.planned_start
  ) agg ON true
  WHERE agg.qt > 0
    AND (p.planned_start_date IS DISTINCT FROM agg.mn
         OR p.planned_end_date IS DISTINCT FROM agg.mx);

  -- Cria registro inicial da execução
  INSERT INTO public.project_planned_dates_resync_runs
    (id, started_at, projects_total, projects_out_of_sync_before, out_of_sync_ids_before)
  VALUES
    (v_run_id, v_started, v_total, COALESCE(array_length(v_out_before, 1), 0), v_out_before);

  BEGIN
    FOR r IN
      SELECT id, planned_start_date, planned_end_date
      FROM public.projects
      WHERE id = ANY(v_out_before)
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

        v_changed_ids := v_changed_ids || r.id;
        v_changed_total := v_changed_total + 1;
      END IF;
    END LOOP;

    -- Re-checa quem ainda está fora de sincronia DEPOIS
    SELECT COALESCE(array_agg(p.id ORDER BY p.id), '{}')
      INTO v_still_out
    FROM public.projects p
    LEFT JOIN LATERAL (
      SELECT MIN(planned_start) AS mn, MAX(planned_end) AS mx, COUNT(*) AS qt
      FROM public.project_activities a
      WHERE a.project_id = p.id
        AND a.planned_start IS NOT NULL
        AND a.planned_end IS NOT NULL
        AND a.planned_end >= a.planned_start
    ) agg ON true
    WHERE agg.qt > 0
      AND (p.planned_start_date IS DISTINCT FROM agg.mn
           OR p.planned_end_date IS DISTINCT FROM agg.mx);

  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;

  UPDATE public.project_planned_dates_resync_runs
     SET finished_at = clock_timestamp(),
         duration_ms = EXTRACT(EPOCH FROM (clock_timestamp() - v_started))::INTEGER * 1000,
         projects_changed = v_changed_total,
         changed_ids = v_changed_ids,
         still_out_of_sync_ids_after = v_still_out,
         error = v_err
   WHERE id = v_run_id;

  RETURN v_changed_total;
END;
$$;
