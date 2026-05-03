
-- Índice cobrindo o cálculo de MIN/MAX por obra (com filtro de validade)
CREATE INDEX IF NOT EXISTS idx_project_activities_project_planned_valid
  ON public.project_activities (project_id, planned_start, planned_end)
  WHERE planned_start IS NOT NULL
    AND planned_end IS NOT NULL;

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
  v_err TEXT;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.projects;

  -- 1) Calcula em lote MIN/MAX válidos por obra e detecta divergências
  --    (uma única varredura por aggregate, usando o índice parcial).
  WITH agg AS (
    SELECT a.project_id,
           MIN(a.planned_start) AS mn,
           MAX(a.planned_end)   AS mx
    FROM public.project_activities a
    WHERE a.planned_start IS NOT NULL
      AND a.planned_end   IS NOT NULL
      AND a.planned_end  >= a.planned_start
    GROUP BY a.project_id
  ),
  diff AS (
    SELECT p.id, p.planned_start_date AS old_start, p.planned_end_date AS old_end,
           agg.mn AS new_start, agg.mx AS new_end,
           (SELECT COUNT(*) FROM public.project_activities a2
              WHERE a2.project_id = p.id
                AND a2.planned_start IS NOT NULL
                AND a2.planned_end   IS NOT NULL
                AND a2.planned_end  >= a2.planned_start) AS qt
    FROM public.projects p
    JOIN agg ON agg.project_id = p.id
    WHERE p.planned_start_date IS DISTINCT FROM agg.mn
       OR p.planned_end_date   IS DISTINCT FROM agg.mx
  )
  SELECT COALESCE(array_agg(id ORDER BY id), '{}') INTO v_out_before FROM diff;

  -- Registro inicial da execução
  INSERT INTO public.project_planned_dates_resync_runs
    (id, started_at, projects_total, projects_out_of_sync_before, out_of_sync_ids_before)
  VALUES
    (v_run_id, v_started, v_total,
     COALESCE(array_length(v_out_before, 1), 0), v_out_before);

  BEGIN
    -- 2) Atualização em lote — apenas linhas que realmente mudam.
    --    DISTINCT FROM no WHERE evita writes redundantes e UPDATE
    --    com MVCC garante lock só nas linhas tocadas.
    WITH agg AS (
      SELECT a.project_id,
             MIN(a.planned_start) AS mn,
             MAX(a.planned_end)   AS mx,
             COUNT(*)             AS qt
      FROM public.project_activities a
      WHERE a.planned_start IS NOT NULL
        AND a.planned_end   IS NOT NULL
        AND a.planned_end  >= a.planned_start
      GROUP BY a.project_id
    ),
    upd AS (
      UPDATE public.projects p
         SET planned_start_date = agg.mn,
             planned_end_date   = agg.mx,
             updated_at = now()
        FROM agg
       WHERE p.id = agg.project_id
         AND agg.qt > 0
         AND (p.planned_start_date IS DISTINCT FROM agg.mn
              OR p.planned_end_date IS DISTINCT FROM agg.mx)
       RETURNING p.id, agg.qt,
                 p.planned_start_date AS new_start,
                 p.planned_end_date   AS new_end
    )
    SELECT COALESCE(array_agg(id ORDER BY id), '{}'), COUNT(*)
      INTO v_changed_ids, v_changed_total
      FROM upd;

    -- 3) Auditoria por obra (uma linha por obra alterada)
    INSERT INTO public.project_planned_dates_sync_log
      (project_id, source, trigger_op,
       old_planned_start, old_planned_end,
       new_planned_start, new_planned_end,
       activities_considered, changed)
    SELECT p.id, 'resync', NULL,
           NULL, NULL,
           p.planned_start_date, p.planned_end_date,
           0, true
    FROM public.projects p
    WHERE p.id = ANY(v_changed_ids);

    -- 4) Re-checa estado pós-execução (deve estar vazio em condições normais)
    WITH agg AS (
      SELECT a.project_id,
             MIN(a.planned_start) AS mn,
             MAX(a.planned_end)   AS mx
      FROM public.project_activities a
      WHERE a.planned_start IS NOT NULL
        AND a.planned_end   IS NOT NULL
        AND a.planned_end  >= a.planned_start
      GROUP BY a.project_id
    )
    SELECT COALESCE(array_agg(p.id ORDER BY p.id), '{}')
      INTO v_still_out
      FROM public.projects p
      JOIN agg ON agg.project_id = p.id
     WHERE p.planned_start_date IS DISTINCT FROM agg.mn
        OR p.planned_end_date   IS DISTINCT FROM agg.mx;

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
