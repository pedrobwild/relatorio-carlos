
-- Onda B1: RPCs de custos (staff-only, agregação em SQL)

CREATE OR REPLACE FUNCTION public.get_project_cost_summary(p_project_id uuid)
RETURNS TABLE (
  category text,
  orcado numeric,
  comprometido numeric,
  realizado numeric,
  saldo numeric,
  consumido_pct numeric,
  purchases_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_project_access(auth.uid(), p_project_id) THEN
    RAISE EXCEPTION 'project_access_denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH latest_orcamento AS (
    SELECT o.id
    FROM public.orcamentos o
    WHERE o.project_id = p_project_id
    ORDER BY o.updated_at DESC NULLS LAST, o.created_at DESC
    LIMIT 1
  ),
  budget AS (
    SELECT
      COALESCE(NULLIF(BTRIM(oi.item_category), ''), 'Sem categoria') AS category,
      SUM(COALESCE(oi.internal_total, 0))::numeric AS orcado
    FROM public.orcamento_items oi
    JOIN public.orcamento_sections os ON os.id = oi.section_id
    JOIN latest_orcamento lo ON lo.id = os.orcamento_id
    GROUP BY 1
  ),
  purchases AS (
    SELECT
      COALESCE(NULLIF(BTRIM(pp.category), ''), 'Sem categoria') AS category,
      pp.id,
      COALESCE(pp.actual_cost, pp.estimated_cost, 0)::numeric AS total,
      COALESCE(
        pp.paid_amount,
        CASE WHEN pp.paid_at IS NOT NULL
             THEN COALESCE(pp.actual_cost, pp.estimated_cost, 0)
             ELSE 0 END
      )::numeric AS pago,
      pp.status
    FROM public.project_purchases pp
    WHERE pp.project_id = p_project_id
      AND COALESCE(pp.status, '') <> 'cancelled'
  ),
  purchases_agg AS (
    SELECT
      p.category,
      SUM(p.pago) AS realizado,
      SUM(GREATEST(p.total - p.pago, 0)) AS comprometido,
      COUNT(*)::int AS purchases_count
    FROM purchases p
    GROUP BY 1
  )
  SELECT
    COALESCE(b.category, pa.category) AS category,
    COALESCE(b.orcado, 0) AS orcado,
    COALESCE(pa.comprometido, 0) AS comprometido,
    COALESCE(pa.realizado, 0) AS realizado,
    (COALESCE(b.orcado, 0) - COALESCE(pa.comprometido, 0) - COALESCE(pa.realizado, 0)) AS saldo,
    CASE WHEN COALESCE(b.orcado, 0) > 0
         THEN ROUND(((COALESCE(pa.comprometido, 0) + COALESCE(pa.realizado, 0)) / b.orcado) * 100, 2)
         ELSE NULL END AS consumido_pct,
    COALESCE(pa.purchases_count, 0) AS purchases_count
  FROM budget b
  FULL OUTER JOIN purchases_agg pa ON pa.category = b.category
  ORDER BY (COALESCE(b.orcado, 0) + COALESCE(pa.comprometido, 0) + COALESCE(pa.realizado, 0)) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_project_cost_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_project_cost_summary(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_project_cost_totals(p_project_id uuid)
RETURNS TABLE (
  orcado numeric,
  comprometido numeric,
  realizado numeric,
  saldo numeric,
  eac numeric,
  variacao numeric,
  variacao_pct numeric,
  categories_count integer,
  categories_over_budget integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_project_access(auth.uid(), p_project_id) THEN
    RAISE EXCEPTION 'project_access_denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH rows AS (
    SELECT * FROM public.get_project_cost_summary(p_project_id)
  ),
  agg AS (
    SELECT
      SUM(orcado)::numeric        AS orcado,
      SUM(comprometido)::numeric  AS comprometido,
      SUM(realizado)::numeric     AS realizado,
      SUM(GREATEST(orcado - comprometido - realizado, 0))::numeric AS saldo_restante,
      COUNT(*)::int                AS categories_count,
      COUNT(*) FILTER (WHERE (comprometido + realizado) > orcado AND orcado > 0)::int AS categories_over_budget
    FROM rows
  )
  SELECT
    a.orcado,
    a.comprometido,
    a.realizado,
    (a.orcado - a.comprometido - a.realizado) AS saldo,
    -- EAC simples: realizado + comprometido + saldo restante do orçado por categoria (estimativa do restante)
    (a.realizado + a.comprometido + a.saldo_restante) AS eac,
    ((a.realizado + a.comprometido + a.saldo_restante) - a.orcado) AS variacao,
    CASE WHEN a.orcado > 0
         THEN ROUND((((a.realizado + a.comprometido + a.saldo_restante) - a.orcado) / a.orcado) * 100, 2)
         ELSE NULL END AS variacao_pct,
    a.categories_count,
    a.categories_over_budget
  FROM agg a;
END;
$$;

REVOKE ALL ON FUNCTION public.get_project_cost_totals(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_project_cost_totals(uuid) TO authenticated;
