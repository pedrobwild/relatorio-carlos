-- =====================================================================
-- Fase 1 da reformulação do processo core: PRAZO CONTRATUAL
--
-- O contrato fixa N dias úteis a partir de um gatilho de início; atraso gera
-- multa. Até aqui o nº de dias úteis era calculado no formulário de nova obra
-- e descartado. Esta migration:
--   1. guarda os termos do contrato em `projects`;
--   2. cria `contract_term_amendments` (aditivos de prazo);
--   3. porta o calendário de dias úteis (feriados nacionais + SP, de
--      src/lib/businessDays.ts) para o banco, somando project_non_working_days;
--   4. cria a view `v_project_deadlines` (somente staff);
--   5. preenche retroativamente obras em execução a partir de
--      planned_start_date / planned_end_date, marcadas como NÃO confirmadas.
-- Idempotente. Nenhuma tela do cliente lê estes objetos.
-- =====================================================================

-- 1) Enums ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.contract_start_trigger AS ENUM
    ('inicio_oficial', 'assinatura', 'liberacao_condominio', 'entrega_chaves', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.contract_amendment_reason AS ENUM
    ('cliente_decisao', 'cliente_fornecimento', 'condominio', 'forca_maior', 'projeto_terceiros', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.contract_amendment_status AS ENUM
    ('rascunho', 'enviado', 'aceito', 'contestado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Termos do contrato em projects ----------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS contract_business_days integer
    CHECK (contract_business_days IS NULL OR contract_business_days > 0),
  ADD COLUMN IF NOT EXISTS contract_start_trigger public.contract_start_trigger,
  ADD COLUMN IF NOT EXISTS contract_start_date date,
  ADD COLUMN IF NOT EXISTS penalty_pct_per_day numeric(6,3)
    CHECK (penalty_pct_per_day IS NULL OR penalty_pct_per_day >= 0),
  ADD COLUMN IF NOT EXISTS penalty_cap_pct numeric(6,2)
    CHECK (penalty_cap_pct IS NULL OR (penalty_cap_pct >= 0 AND penalty_cap_pct <= 100)),
  ADD COLUMN IF NOT EXISTS contract_terms_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS contract_terms_confirmed_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.projects.contract_business_days IS 'Nº de dias úteis de execução firmados em contrato.';
COMMENT ON COLUMN public.projects.contract_start_trigger IS 'Evento que dispara a contagem do prazo contratual.';
COMMENT ON COLUMN public.projects.contract_start_date IS 'Data em que o gatilho de início ocorreu (dia 0 da contagem).';
COMMENT ON COLUMN public.projects.penalty_pct_per_day IS 'Multa: % do valor do contrato por dia útil de atraso.';
COMMENT ON COLUMN public.projects.penalty_cap_pct IS 'Teto da multa em % do valor do contrato.';
COMMENT ON COLUMN public.projects.contract_terms_confirmed_at IS 'Quando o escritório conferiu os termos com o contrato. NULL = preenchido automaticamente / pendente.';

-- 3) Aditivos de prazo -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.contract_term_amendments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  reason              public.contract_amendment_reason NOT NULL,
  business_days_added integer NOT NULL CHECK (business_days_added > 0),
  description         text NOT NULL,
  event_date          date NOT NULL DEFAULT CURRENT_DATE,
  evidence_urls       text[] NOT NULL DEFAULT '{}',
  formalization_id    uuid REFERENCES public.formalizations(id) ON DELETE SET NULL,
  status              public.contract_amendment_status NOT NULL DEFAULT 'rascunho',
  created_by          uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contract_term_amendments_project_idx
  ON public.contract_term_amendments (project_id, status);

DROP TRIGGER IF EXISTS update_contract_term_amendments_updated_at ON public.contract_term_amendments;
CREATE TRIGGER update_contract_term_amendments_updated_at
  BEFORE UPDATE ON public.contract_term_amendments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.contract_term_amendments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cta_select_staff" ON public.contract_term_amendments;
CREATE POLICY "cta_select_staff"
  ON public.contract_term_amendments FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), project_id));

-- O cliente vê apenas aditivos ACEITOS da própria obra (são parte do contrato dele).
DROP POLICY IF EXISTS "cta_select_customer_accepted" ON public.contract_term_amendments;
CREATE POLICY "cta_select_customer_accepted"
  ON public.contract_term_amendments FOR SELECT TO authenticated
  USING (status = 'aceito' AND public.has_project_access(auth.uid(), project_id));

DROP POLICY IF EXISTS "cta_write_staff" ON public.contract_term_amendments;
CREATE POLICY "cta_write_staff"
  ON public.contract_term_amendments FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), project_id))
  WITH CHECK (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), project_id));

-- 4) Calendário de dias úteis ----------------------------------------
-- Porte fiel de src/lib/businessDays.ts (algoritmo gregoriano anônimo).
CREATE OR REPLACE FUNCTION public.easter_sunday(p_year integer)
RETURNS date
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$
DECLARE
  a int := p_year % 19;
  b int := p_year / 100;
  c int := p_year % 100;
  d int := b / 4;
  e int := b % 4;
  f int := (b + 8) / 25;
  g int := (b - f + 1) / 3;
  h int := (19 * a + b - d - g + 15) % 30;
  i int := c / 4;
  k int := c % 4;
  l int := (32 + 2 * e + 2 * i - h - k) % 7;
  m int := (a + 11 * h + 22 * l) / 451;
  mon int := (h + l - 7 * m + 114) / 31;
  dy int := ((h + l - 7 * m + 114) % 31) + 1;
BEGIN
  RETURN make_date(p_year, mon, dy);
END;
$$;

-- Feriados nacionais + estaduais/municipais de São Paulo (mesma lista do front).
CREATE OR REPLACE FUNCTION public.is_sp_holiday(p_day date)
RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$
  SELECT
    (extract(month FROM p_day)::int, extract(day FROM p_day)::int) IN (
      (1, 1), (1, 25), (4, 21), (5, 1), (7, 9), (9, 7),
      (10, 12), (11, 2), (11, 15), (11, 20), (12, 25)
    )
    OR p_day IN (
      public.easter_sunday(extract(year FROM p_day)::int) - 48, -- Carnaval (seg)
      public.easter_sunday(extract(year FROM p_day)::int) - 47, -- Carnaval (ter)
      public.easter_sunday(extract(year FROM p_day)::int) - 2,  -- Sexta-feira Santa
      public.easter_sunday(extract(year FROM p_day)::int) + 60  -- Corpus Christi
    );
$$;

-- Dias não úteis cadastrados (globais + da obra). SECURITY DEFINER para que o
-- cálculo do prazo seja o mesmo para qualquer papel; expõe só datas.
CREATE OR REPLACE FUNCTION public.project_extra_non_working_days(p_project_id uuid)
RETURNS date[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(n.day), '{}'::date[])
  FROM public.project_non_working_days n
  WHERE n.project_id IS NULL OR n.project_id = p_project_id;
$$;

CREATE OR REPLACE FUNCTION public.is_business_day(p_day date, p_extra date[] DEFAULT '{}'::date[])
RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$
  SELECT extract(isodow FROM p_day) < 6
     AND NOT public.is_sp_holiday(p_day)
     AND NOT (p_day = ANY (coalesce(p_extra, '{}'::date[])));
$$;

-- Mesmo comportamento de addBusinessDays() do front: se o início não for dia
-- útil, avança até o próximo; depois soma N dias úteis.
CREATE OR REPLACE FUNCTION public.add_business_days(p_project_id uuid, p_start date, p_n integer)
RETURNS date
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  v_day   date := p_start;
  v_added int  := 0;
  v_n     int  := greatest(coalesce(p_n, 0), 0);
  v_extra date[];
BEGIN
  IF p_start IS NULL OR p_n IS NULL THEN
    RETURN NULL;
  END IF;
  v_extra := public.project_extra_non_working_days(p_project_id);
  WHILE NOT public.is_business_day(v_day, v_extra) LOOP
    v_day := v_day + 1;
  END LOOP;
  WHILE v_added < v_n LOOP
    v_day := v_day + 1;
    IF public.is_business_day(v_day, v_extra) THEN
      v_added := v_added + 1;
    END IF;
  END LOOP;
  RETURN v_day;
END;
$$;

-- Mesmo comportamento de countBusinessDaysInclusive(): conta os dois extremos.
CREATE OR REPLACE FUNCTION public.count_business_days(p_project_id uuid, p_from date, p_to date)
RETURNS integer
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH x AS (SELECT public.project_extra_non_working_days(p_project_id) AS extra)
  SELECT CASE
    WHEN p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN 0
    ELSE (
      SELECT count(*)::int
      FROM generate_series(p_from, p_to, interval '1 day') AS g(day), x
      WHERE public.is_business_day(g.day::date, x.extra)
    )
  END;
$$;

-- 5) View de prazos (somente staff) ----------------------------------
-- Dia de referência = entrega real, ou hoje em São Paulo.
CREATE OR REPLACE VIEW public.v_project_deadlines
WITH (security_invoker = true) AS
WITH base AS (
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
    coalesce((
      SELECT sum(a.business_days_added)
      FROM public.contract_term_amendments a
      WHERE a.project_id = p.id AND a.status = 'aceito'
    ), 0)::int                    AS amendment_business_days,
    coalesce((
      SELECT count(*)
      FROM public.contract_term_amendments a
      WHERE a.project_id = p.id AND a.status IN ('rascunho', 'enviado')
    ), 0)::int                    AS amendments_pending,
    coalesce(p.actual_end_date, (now() AT TIME ZONE 'America/Sao_Paulo')::date) AS reference_date
  FROM public.projects p
  WHERE p.deleted_at IS NULL
    AND public.is_staff(auth.uid())
),
dl AS (
  SELECT
    b.*,
    public.add_business_days(b.project_id, b.contract_start_date, 0) AS effective_start_date,
    public.add_business_days(b.project_id, b.contract_start_date, b.contract_business_days) AS contract_deadline,
    public.add_business_days(b.project_id, b.contract_start_date,
      b.contract_business_days + b.amendment_business_days) AS current_deadline,
    (b.contract_business_days + b.amendment_business_days) AS current_business_days
  FROM base b
),
calc AS (
  SELECT
    dl.*,
    CASE WHEN dl.current_deadline IS NULL THEN NULL
         ELSE public.count_business_days(dl.project_id, dl.effective_start_date + 1,
                least(dl.reference_date, dl.current_deadline))
    END AS business_days_elapsed,
    CASE WHEN dl.current_deadline IS NULL THEN NULL
         WHEN dl.reference_date <= dl.current_deadline
           THEN public.count_business_days(dl.project_id, dl.reference_date + 1, dl.current_deadline)
         ELSE -public.count_business_days(dl.project_id, dl.current_deadline + 1, dl.reference_date)
    END AS business_days_remaining
  FROM dl
)
SELECT
  calc.*,
  greatest(0, -calc.business_days_remaining)                    AS business_days_late,
  CASE WHEN calc.current_business_days > 0
       THEN round(100.0 * calc.business_days_elapsed / calc.current_business_days, 1)
  END                                                           AS pct_prazo_consumido,
  CASE WHEN calc.penalty_pct_per_day IS NULL THEN NULL
       ELSE least(greatest(0, -calc.business_days_remaining) * calc.penalty_pct_per_day,
                  coalesce(calc.penalty_cap_pct, 100))
  END                                                           AS penalty_accrued_pct,
  CASE WHEN calc.penalty_pct_per_day IS NULL OR calc.contract_value IS NULL THEN NULL
       ELSE round(calc.contract_value *
              least(greatest(0, -calc.business_days_remaining) * calc.penalty_pct_per_day,
                    coalesce(calc.penalty_cap_pct, 100)) / 100.0, 2)
  END                                                           AS penalty_accrued_value
FROM calc;

COMMENT ON VIEW public.v_project_deadlines IS
  'Prazo contratual por obra (somente staff): entrega contratual, vigente (com aditivos aceitos), dias úteis decorridos/restantes/atraso e multa acumulada.';

GRANT SELECT ON public.v_project_deadlines TO authenticated;

-- 6) Preenchimento retroativo ----------------------------------------
-- Obras em execução que têm datas planejadas: o prazo contratual passa a ser
-- exatamente o que o formulário calculou (planned_start + N dias úteis =
-- planned_end). Fica com contract_terms_confirmed_at = NULL para o escritório
-- conferir com o contrato. Gatilho e multa ficam em branco (não inventamos).
UPDATE public.projects p
SET contract_start_date    = p.planned_start_date,
    contract_business_days = public.count_business_days(
      p.id,
      public.add_business_days(p.id, p.planned_start_date, 0) + 1,
      p.planned_end_date)
WHERE p.deleted_at IS NULL
  AND coalesce(p.is_project_phase, false) = false
  AND p.contract_business_days IS NULL
  AND p.contract_start_date IS NULL
  AND p.planned_start_date IS NOT NULL
  AND p.planned_end_date IS NOT NULL
  AND p.planned_end_date > p.planned_start_date;
