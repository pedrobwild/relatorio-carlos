
-- Onda B2: RPC de Curva S financeira semanal (staff-only)
CREATE OR REPLACE FUNCTION public.get_project_cost_s_curve_weekly(p_project_id uuid)
RETURNS TABLE (
  week_start date,
  planned_cum numeric,
  realized_cum numeric,
  committed_projected_cum numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start date;
  v_end   date;
  v_orcado numeric := 0;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_project_access(auth.uid(), p_project_id) THEN
    RAISE EXCEPTION 'project_access_denied' USING ERRCODE = '42501';
  END IF;

  -- Janela: prefer planned_*, fallback actual_*, fallback min/max de purchases
  SELECT
    COALESCE(p.planned_start_date, p.actual_start_date, p.date_mobilization_start),
    COALESCE(p.planned_end_date, p.actual_end_date, p.date_official_delivery)
    INTO v_start, v_end
  FROM public.projects p WHERE p.id = p_project_id;

  IF v_start IS NULL OR v_end IS NULL THEN
    SELECT
      COALESCE(v_start, MIN(LEAST(pp.order_date, pp.planned_purchase_date, pp.paid_at::date))),
      COALESCE(v_end,   MAX(GREATEST(pp.paid_at::date, pp.actual_delivery_date, pp.expected_delivery_date, pp.order_date)))
      INTO v_start, v_end
    FROM public.project_purchases pp
    WHERE pp.project_id = p_project_id;
  END IF;

  IF v_start IS NULL OR v_end IS NULL OR v_end < v_start THEN
    RETURN;  -- Sem janela viável: retorna vazio
  END IF;

  -- Alinha para segunda-feira
  v_start := date_trunc('week', v_start)::date;
  v_end   := date_trunc('week', v_end)::date;

  -- Total orçado (último orçamento)
  WITH lo AS (
    SELECT o.id FROM public.orcamentos o
    WHERE o.project_id = p_project_id
    ORDER BY o.updated_at DESC NULLS LAST, o.created_at DESC LIMIT 1
  )
  SELECT COALESCE(SUM(COALESCE(oi.internal_total, 0)), 0)::numeric
    INTO v_orcado
  FROM public.orcamento_items oi
  JOIN public.orcamento_sections os ON os.id = oi.section_id
  JOIN lo ON lo.id = os.orcamento_id;

  RETURN QUERY
  WITH weeks AS (
    SELECT gs::date AS week_start
    FROM generate_series(v_start, v_end, interval '1 week') gs
  ),
  wk_count AS (SELECT GREATEST(COUNT(*),1) AS n FROM weeks),
  planned AS (
    SELECT w.week_start,
           (v_orcado / (SELECT n FROM wk_count))::numeric AS planned_val
    FROM weeks w
  ),
  realized AS (
    SELECT date_trunc('week', pp.paid_at)::date AS week_start,
           SUM(COALESCE(pp.paid_amount,
                        CASE WHEN pp.paid_at IS NOT NULL
                             THEN COALESCE(pp.actual_cost, pp.estimated_cost, 0)
                             ELSE 0 END))::numeric AS realized_val
    FROM public.project_purchases pp
    WHERE pp.project_id = p_project_id
      AND COALESCE(pp.status,'') <> 'cancelled'
      AND pp.paid_at IS NOT NULL
    GROUP BY 1
  ),
  committed AS (
    SELECT date_trunc('week',
             COALESCE(pp.order_date, pp.planned_purchase_date, pp.created_at::date)
           )::date AS week_start,
           SUM(
             GREATEST(
               COALESCE(pp.actual_cost, pp.estimated_cost, 0)
               - COALESCE(pp.paid_amount,
                          CASE WHEN pp.paid_at IS NOT NULL
                               THEN COALESCE(pp.actual_cost, pp.estimated_cost, 0)
                               ELSE 0 END),
               0)
           )::numeric AS committed_val
    FROM public.project_purchases pp
    WHERE pp.project_id = p_project_id
      AND COALESCE(pp.status,'') <> 'cancelled'
    GROUP BY 1
  ),
  merged AS (
    SELECT w.week_start,
           COALESCE(p.planned_val, 0)   AS planned_val,
           COALESCE(r.realized_val, 0)  AS realized_val,
           COALESCE(c.committed_val, 0) AS committed_val
    FROM weeks w
    LEFT JOIN planned   p ON p.week_start = w.week_start
    LEFT JOIN realized  r ON r.week_start = w.week_start
    LEFT JOIN committed c ON c.week_start = w.week_start
  )
  SELECT
    m.week_start,
    SUM(m.planned_val)   OVER (ORDER BY m.week_start ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW),
    SUM(m.realized_val)  OVER (ORDER BY m.week_start ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW),
    SUM(m.realized_val + m.committed_val) OVER (ORDER BY m.week_start ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
  FROM merged m
  ORDER BY m.week_start;
END;
$$;

REVOKE ALL ON FUNCTION public.get_project_cost_s_curve_weekly(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_project_cost_s_curve_weekly(uuid) TO authenticated, service_role;
