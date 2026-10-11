-- =====================================================================
-- Correção de desempenho do PRAZO CONTRATUAL (Fase 1)
--
-- Sintoma: as telas Obras, Semana e Hoje (e a coluna de prazo do Painel de
-- Obras) não carregavam. Todas leem `v_project_deadlines` para a carteira
-- inteira, e essa consulta levava ~20 s — acima do limite de 8 s do papel
-- `authenticated`. O banco cancelava a consulta ("statement timeout").
--
-- Causas:
--   1. A view encadeava CTEs que o Postgres expande em linha: cada
--      add_business_days / count_business_days era recalculado dezenas de
--      vezes por obra.
--   2. Cada dia do calendário custava ~0,14 ms (is_business_day →
--      is_sp_holiday → 4x easter_sunday, todas com SET search_path).
--
-- Correção (mesmo resultado, mesmas colunas):
--   1. `sp_holidays_for_year` monta os feriados do ano uma única vez.
--   2. add_business_days / count_business_days usam essa lista em vez de
--      chamar is_business_day dia a dia.
--   3. A view calcula cada prazo uma vez por obra (LATERAL ... OFFSET 0).
--
-- is_business_day / is_sp_holiday / easter_sunday continuam como estão.
-- Idempotente.
-- =====================================================================

-- 1) Feriados de um ano (nacionais + SP), mesma lista de is_sp_holiday --
CREATE OR REPLACE FUNCTION public.sp_holidays_for_year(p_year integer)
RETURNS date[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$
  SELECT ARRAY[
    make_date(p_year, 1, 1),   make_date(p_year, 1, 25),  make_date(p_year, 4, 21),
    make_date(p_year, 5, 1),   make_date(p_year, 7, 9),   make_date(p_year, 9, 7),
    make_date(p_year, 10, 12), make_date(p_year, 11, 2),  make_date(p_year, 11, 15),
    make_date(p_year, 11, 20), make_date(p_year, 12, 25),
    x.e - 48,  -- Carnaval (seg)
    x.e - 47,  -- Carnaval (ter)
    x.e - 2,   -- Sexta-feira Santa
    x.e + 60   -- Corpus Christi
  ]
  FROM (SELECT public.easter_sunday(p_year) AS e) x;
$$;

-- 2) add_business_days: mesmo comportamento, sem chamada de função por dia
CREATE OR REPLACE FUNCTION public.add_business_days(p_project_id uuid, p_start date, p_n integer)
RETURNS date
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  v_day      date := p_start;
  v_added    int  := 0;
  v_n        int  := greatest(coalesce(p_n, 0), 0);
  v_extra    date[];
  v_hol      date[];
  v_hol_year int;
  v_year     int;
  v_started  boolean := false;
  v_is_bd    boolean;
BEGIN
  IF p_start IS NULL OR p_n IS NULL THEN
    RETURN NULL;
  END IF;
  v_extra := coalesce(public.project_extra_non_working_days(p_project_id), '{}'::date[]);
  LOOP
    v_year := extract(year FROM v_day)::int;
    IF v_hol_year IS DISTINCT FROM v_year THEN
      v_hol_year := v_year;
      v_hol := public.sp_holidays_for_year(v_year);
    END IF;
    v_is_bd := extract(isodow FROM v_day) < 6
           AND NOT (v_day = ANY (v_hol))
           AND NOT (v_day = ANY (v_extra));

    IF NOT v_started THEN
      -- Fase 1: se o início não for dia útil, avança até o próximo.
      IF v_is_bd THEN
        v_started := true;
        EXIT WHEN v_n = 0;
      END IF;
    ELSIF v_is_bd THEN
      -- Fase 2: soma N dias úteis.
      v_added := v_added + 1;
      EXIT WHEN v_added >= v_n;
    END IF;
    v_day := v_day + 1;
  END LOOP;
  RETURN v_day;
END;
$$;

-- 3) count_business_days: conta os dois extremos, feriados montados 1x --
CREATE OR REPLACE FUNCTION public.count_business_days(p_project_id uuid, p_from date, p_to date)
RETURNS integer
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN 0
    ELSE (
      WITH x AS (
        SELECT
          coalesce(public.project_extra_non_working_days(p_project_id), '{}'::date[]) AS extra,
          (
            SELECT array_agg(h.d)
            FROM generate_series(extract(year FROM p_from)::int, extract(year FROM p_to)::int) AS y(yr)
            CROSS JOIN LATERAL unnest(public.sp_holidays_for_year(y.yr)) AS h(d)
          ) AS hol
      )
      SELECT count(*)::int
      FROM x
      CROSS JOIN LATERAL generate_series(0, p_to - p_from) AS g(i)
      WHERE extract(isodow FROM p_from + g.i) < 6
        AND NOT ((p_from + g.i) = ANY (x.hol))
        AND NOT ((p_from + g.i) = ANY (x.extra))
    )
  END;
$$;

-- 4) View: cada prazo calculado uma única vez por obra ----------------
-- Mesmas colunas, na mesma ordem. OFFSET 0 impede o Postgres de expandir as
-- subconsultas em linha (era isso que multiplicava o custo); os filtros por
-- obra (project_id, is_project_phase) continuam sendo aplicados antes.
CREATE OR REPLACE VIEW public.v_project_deadlines
WITH (security_invoker = true) AS
SELECT
  p.id                          AS project_id,
  p.name                        AS project_name,
  p.status,
  p.is_project_phase,
  p.contract_business_days,
  p.contract_start_trigger,
  p.contract_start_date,
  p.penalty_pct_per_day,
  p.penalty_cap_pct,
  p.contract_value,
  p.actual_end_date,
  p.contract_terms_confirmed_at,
  (p.contract_terms_confirmed_at IS NOT NULL) AS contract_terms_confirmed,
  am.amendment_business_days,
  am.amendments_pending,
  ref.reference_date,
  dl.effective_start_date,
  dl.contract_deadline,
  dl.current_deadline,
  (p.contract_business_days + am.amendment_business_days) AS current_business_days,
  calc.business_days_elapsed,
  calc.business_days_remaining,
  greatest(0, -calc.business_days_remaining)                    AS business_days_late,
  CASE WHEN (p.contract_business_days + am.amendment_business_days) > 0
       THEN round(100.0 * calc.business_days_elapsed
                  / (p.contract_business_days + am.amendment_business_days), 1)
  END                                                           AS pct_prazo_consumido,
  CASE WHEN p.penalty_pct_per_day IS NULL THEN NULL
       ELSE least(greatest(0, -calc.business_days_remaining) * p.penalty_pct_per_day,
                  coalesce(p.penalty_cap_pct, 100))
  END                                                           AS penalty_accrued_pct,
  CASE WHEN p.penalty_pct_per_day IS NULL OR p.contract_value IS NULL THEN NULL
       ELSE round(p.contract_value *
              least(greatest(0, -calc.business_days_remaining) * p.penalty_pct_per_day,
                    coalesce(p.penalty_cap_pct, 100)) / 100.0, 2)
  END                                                           AS penalty_accrued_value
FROM public.projects p
CROSS JOIN LATERAL (
  SELECT
    coalesce(sum(a.business_days_added) FILTER (WHERE a.status = 'aceito'), 0)::int AS amendment_business_days,
    (count(*) FILTER (WHERE a.status IN ('rascunho', 'enviado')))::int               AS amendments_pending
  FROM public.contract_term_amendments a
  WHERE a.project_id = p.id
) am
CROSS JOIN LATERAL (
  -- Dia de referência = entrega real, ou hoje em São Paulo.
  SELECT coalesce(p.actual_end_date, (now() AT TIME ZONE 'America/Sao_Paulo')::date) AS reference_date
  OFFSET 0
) ref
CROSS JOIN LATERAL (
  SELECT
    public.add_business_days(p.id, p.contract_start_date, 0) AS effective_start_date,
    public.add_business_days(p.id, p.contract_start_date, p.contract_business_days) AS contract_deadline,
    public.add_business_days(p.id, p.contract_start_date,
      p.contract_business_days + am.amendment_business_days) AS current_deadline
  OFFSET 0
) dl
CROSS JOIN LATERAL (
  SELECT
    CASE WHEN dl.current_deadline IS NULL THEN NULL
         ELSE public.count_business_days(p.id, dl.effective_start_date + 1,
                least(ref.reference_date, dl.current_deadline))
    END AS business_days_elapsed,
    CASE WHEN dl.current_deadline IS NULL THEN NULL
         WHEN ref.reference_date <= dl.current_deadline
           THEN public.count_business_days(p.id, ref.reference_date + 1, dl.current_deadline)
         ELSE -public.count_business_days(p.id, dl.current_deadline + 1, ref.reference_date)
    END AS business_days_remaining
  OFFSET 0
) calc
WHERE p.deleted_at IS NULL
  AND public.is_staff(auth.uid());

COMMENT ON VIEW public.v_project_deadlines IS
  'Prazo contratual por obra (somente staff): entrega contratual, vigente (com aditivos aceitos), dias úteis decorridos/restantes/atraso e multa acumulada.';

GRANT SELECT ON public.v_project_deadlines TO authenticated;
