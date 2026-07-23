-- Onda P2 · Painel de Obras: estender snapshot gerencial com "compras críticas".
-- Aditivo: acrescenta a coluna compras_criticas ao retorno da RPC batch. Como
-- Postgres não permite alterar RETURNS TABLE via CREATE OR REPLACE, fazemos
-- DROP + CREATE na MESMA migration (função, não tabela — recriada com o mesmo
-- guard de acesso staff-only).

DROP FUNCTION IF EXISTS public.get_portfolio_management_snapshot();

CREATE FUNCTION public.get_portfolio_management_snapshot()
RETURNS TABLE (
  project_id uuid,
  weighted_progress_pct numeric,
  orcado numeric,
  comprometido numeric,
  realizado numeric,
  eac numeric,
  variacao_pct numeric,
  ncs_abertas integer,
  ncs_criticas integer,
  punch_abertos integer,
  atividades_proximos_14d_sem_responsavel integer,
  proxima_atividade_titulo text,
  proxima_atividade_data date,
  compras_criticas integer
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

  RETURN QUERY
  WITH active_projects AS (
    SELECT p.id
    FROM public.projects p
    WHERE p.deleted_at IS NULL
      AND COALESCE(p.status, 'active') NOT IN ('cancelled', 'completed', 'archived')
  ),
  progress AS (
    SELECT ap.id AS project_id,
           public.get_project_weighted_progress(ap.id, NULL) AS weighted_progress_pct
    FROM active_projects ap
  ),
  costs AS (
    SELECT ap.id AS project_id,
           t.orcado, t.comprometido, t.realizado, t.eac, t.variacao_pct
    FROM active_projects ap
    LEFT JOIN LATERAL public.get_project_cost_totals(ap.id) t ON TRUE
  ),
  nc_agg AS (
    SELECT nc.project_id,
           COUNT(*)::int AS ncs_abertas,
           COUNT(*) FILTER (WHERE nc.severity = 'critical')::int AS ncs_criticas
    FROM public.non_conformities nc
    WHERE nc.status IN ('open', 'in_treatment', 'reopened', 'pending_verification', 'pending_approval')
    GROUP BY nc.project_id
  ),
  punch_agg AS (
    SELECT pi.project_id,
           COUNT(*)::int AS punch_abertos
    FROM public.punch_items pi
    WHERE pi.deleted_at IS NULL
      AND pi.status = 'aberto'
    GROUP BY pi.project_id
  ),
  lookahead_agg AS (
    SELECT pa.project_id,
           COUNT(*) FILTER (WHERE pa.responsible_user_id IS NULL)::int AS sem_resp_14d
    FROM public.project_activities pa
    WHERE pa.deleted_at IS NULL
      AND COALESCE(pa.status, 'planned') NOT IN ('completed', 'cancelled')
      AND pa.planned_start_date IS NOT NULL
      AND pa.planned_start_date >= CURRENT_DATE
      AND pa.planned_start_date <= CURRENT_DATE + INTERVAL '14 days'
    GROUP BY pa.project_id
  ),
  next_activity AS (
    SELECT DISTINCT ON (pa.project_id)
           pa.project_id,
           pa.title AS proxima_atividade_titulo,
           pa.planned_start_date AS proxima_atividade_data
    FROM public.project_activities pa
    WHERE pa.deleted_at IS NULL
      AND COALESCE(pa.status, 'planned') NOT IN ('completed', 'cancelled')
      AND pa.planned_start_date IS NOT NULL
      AND pa.planned_start_date >= CURRENT_DATE
    ORDER BY pa.project_id, pa.planned_start_date ASC
  ),
  -- Compras críticas por obra: pedidos com entrega prevista nos próximos 14
  -- dias OU já vencida, ainda não recebidos totalmente. Considera recebimento
  -- por dois canais: actual_delivery_date preenchido (recebido) ou soma de
  -- quantidades em purchase_receipts >= quantity do pedido.
  compras_agg AS (
    SELECT pp.project_id,
           COUNT(*)::int AS compras_criticas
    FROM public.project_purchases pp
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(r.quantidade), 0)::numeric AS recebido
      FROM public.purchase_receipts r
      WHERE r.purchase_id = pp.id
        AND r.deleted_at IS NULL
    ) rc ON TRUE
    WHERE pp.expected_delivery_date IS NOT NULL
      AND pp.expected_delivery_date <= CURRENT_DATE + INTERVAL '14 days'
      AND pp.actual_delivery_date IS NULL
      AND COALESCE(pp.status, '') NOT IN ('cancelado', 'cancelled', 'arquivado', 'archived')
      AND rc.recebido < COALESCE(pp.quantity, 0)
    GROUP BY pp.project_id
  )
  SELECT
    ap.id,
    COALESCE(pr.weighted_progress_pct, 0)::numeric,
    c.orcado, c.comprometido, c.realizado, c.eac, c.variacao_pct,
    COALESCE(nc.ncs_abertas, 0),
    COALESCE(nc.ncs_criticas, 0),
    COALESCE(pu.punch_abertos, 0),
    COALESCE(la.sem_resp_14d, 0),
    na.proxima_atividade_titulo,
    na.proxima_atividade_data,
    COALESCE(cp.compras_criticas, 0)
  FROM active_projects ap
  LEFT JOIN progress pr       ON pr.project_id = ap.id
  LEFT JOIN costs c           ON c.project_id  = ap.id
  LEFT JOIN nc_agg nc         ON nc.project_id = ap.id
  LEFT JOIN punch_agg pu      ON pu.project_id = ap.id
  LEFT JOIN lookahead_agg la  ON la.project_id = ap.id
  LEFT JOIN next_activity na  ON na.project_id = ap.id
  LEFT JOIN compras_agg cp    ON cp.project_id = ap.id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_portfolio_management_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portfolio_management_snapshot() TO authenticated;

COMMENT ON FUNCTION public.get_portfolio_management_snapshot() IS
  'Snapshot batch (staff-only) do portfólio de obras ativas. Consolida avanço físico ponderado, custos/EAC, NCs, punch list, lookahead 14d e compras críticas (Onda P2).';
