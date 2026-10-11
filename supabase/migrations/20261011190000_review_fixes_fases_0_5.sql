-- =====================================================================
-- Correções da revisão das Fases 0–5 (prazo contratual + camada de Operação)
-- =====================================================================
-- Tudo aqui é idempotente e não muda dados existentes.
--
--  1. sync_budget_items_to_purchases: era SECURITY DEFINER sem checagem —
--     qualquer usuário (inclusive cliente e anon) criava compras em
--     qualquer obra. Agora exige equipe com acesso à obra.
--  2. Funções novas de dias úteis / fotos: sem EXECUTE para anon.
--  3. ops_assignments: apagar um usuário ou fornecedor que já foi alocado
--     falhava (FK ON DELETE SET NULL batia no CHECK "quem faz").
--  4. Retrabalho ("Refazer") de atividade sem etapa falhava sempre; e uma
--     atividade já revisada podia ser revisada de novo (retrabalho duplicado).
--  5. v_stage_rollup.pct_done: nunca chegava a 100% depois de um "não feito",
--     ignorava atividades sem dia marcado e contava a atividade refeita.
--  6. Data do aditivo com padrão em UTC: depois das 21h (Brasília) gravava
--     o dia seguinte.
--  7. Limite de sanidade em contract_business_days (um valor absurdo faz a
--     v_project_deadlines estourar o tempo para a carteira inteira).
--  8. Índices nas FKs usadas pelas telas e pelos ON DELETE.
-- =====================================================================

-- 1) Compras: RPC só para equipe com acesso à obra --------------------
CREATE OR REPLACE FUNCTION public.sync_budget_items_to_purchases(p_project_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer := 0;
  v_admin_id uuid;
  v_default_date date := ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 30);
  -- Papel do JWT: 'authenticated' / 'anon' / 'service_role' pela API;
  -- vazio em sessão direta no banco (SQL editor, rotinas internas).
  v_jwt_role text := coalesce(auth.role(), '');
BEGIN
  -- Compras são 100% internas. Pela API, só equipe com acesso a esta obra
  -- (ou service_role, usado pelas rotinas do servidor).
  IF v_jwt_role NOT IN ('service_role', '')
     AND NOT (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), p_project_id)) THEN
    RAISE EXCEPTION 'Sem permissão para sincronizar compras desta obra' USING ERRCODE = '42501';
  END IF;

  -- Find an admin user for created_by
  SELECT id INTO v_admin_id
  FROM public.users_profile
  WHERE perfil = 'admin' AND status = 'ativo'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No active admin found for created_by';
  END IF;

  INSERT INTO public.project_purchases (
    project_id,
    orcamento_item_id,
    item_name,
    description,
    quantity,
    unit,
    estimated_cost,
    category,
    supplier_name,
    fornecedor_id,
    lead_time_days,
    required_by_date,
    status,
    purchase_type,
    created_by
  )
  SELECT
    p_project_id,
    oi.id,
    oi.title,
    oi.description,
    COALESCE(oi.qty, 1),
    COALESCE(oi.unit, 'un'),
    oi.internal_unit_price * COALESCE(oi.qty, 1),  -- total cost without BDI
    oi.item_category,
    oi.supplier_name,
    oi.supplier_id::uuid,
    7,
    v_default_date,
    'pending',
    'produto',
    v_admin_id
  FROM public.orcamento_items oi
  JOIN public.orcamento_sections os ON os.id = oi.section_id
  JOIN public.orcamentos o ON o.id = os.orcamento_id
  WHERE o.project_id = p_project_id
    AND oi.item_category = 'Produto'
    AND NOT EXISTS (
      SELECT 1 FROM public.project_purchases pp
      WHERE pp.orcamento_item_id = oi.id
    )
  ON CONFLICT (orcamento_item_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_budget_items_to_purchases(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_budget_items_to_purchases(uuid) TO authenticated, service_role;

-- 2) Funções das Fases 1–3: anon não executa --------------------------
-- (authenticated continua: as views são security_invoker e as policies de
--  storage chamam ops_photo_project_id com o usuário logado.)
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.easter_sunday(integer)',
    'public.is_sp_holiday(date)',
    'public.sp_holidays_for_year(integer)',
    'public.is_business_day(date, date[])',
    'public.project_extra_non_working_days(uuid)',
    'public.add_business_days(uuid, date, integer)',
    'public.count_business_days(uuid, date, date)',
    'public.ops_photo_project_id(text)'
  ] LOOP
    IF to_regprocedure(f) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
    END IF;
  END LOOP;
END $$;

-- 3) Alocação: apagar usuário/fornecedor não pode travar no CHECK ------
-- O FK zera user_id/fornecedor_id; se era o único "quem faz", fica um nome
-- no lugar (o da pessoa, se o perfil ainda existir; senão um texto fixo)
-- para o CHECK continuar valendo e o histórico não ficar em branco.
CREATE OR REPLACE FUNCTION public.ops_assignments_keep_who()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.fornecedor_id IS NULL
     AND nullif(btrim(coalesce(NEW.worker_name, '')), '') IS NULL
     AND (OLD.user_id IS NOT NULL OR OLD.fornecedor_id IS NOT NULL) THEN
    NEW.worker_name := coalesce(
      (SELECT nullif(btrim(u.nome), '') FROM public.users_profile u WHERE u.id = OLD.user_id),
      (SELECT nullif(btrim(f.nome), '') FROM public.fornecedores f WHERE f.id = OLD.fornecedor_id),
      CASE WHEN OLD.fornecedor_id IS NOT NULL THEN 'Prestador removido' ELSE 'Pessoa removida' END
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS ops_assignments_keep_who_trg ON public.ops_assignments;
CREATE TRIGGER ops_assignments_keep_who_trg
  BEFORE UPDATE OF user_id, fornecedor_id ON public.ops_assignments
  FOR EACH ROW EXECUTE FUNCTION public.ops_assignments_keep_who();

-- 4a) Atividade: retrabalho herda a etapa (ou a falta dela) da original -
CREATE OR REPLACE FUNCTION public.ops_activities_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_stage_project uuid;
BEGIN
  -- Etapa obrigatória na criação. Exceção: retrabalho de atividade cuja
  -- etapa foi removida do cronograma — continua "sem etapa", como a original.
  IF TG_OP = 'INSERT' AND NEW.stage_id IS NULL AND NEW.rework_of_id IS NULL THEN
    RAISE EXCEPTION 'Atividade precisa estar ligada a uma etapa da obra' USING ERRCODE = '23502';
  END IF;
  IF NEW.stage_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.stage_id IS DISTINCT FROM OLD.stage_id
                                   OR NEW.project_id IS DISTINCT FROM OLD.project_id) THEN
    SELECT project_id INTO v_stage_project FROM public.project_activities WHERE id = NEW.stage_id;
    IF v_stage_project IS DISTINCT FROM NEW.project_id THEN
      RAISE EXCEPTION 'A etapa informada pertence a outra obra' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.status <> 'bloqueada' THEN
    NEW.blocked_reason := NULL;
  END IF;
  RETURN NEW;
END $$;

-- 4b) Revisão: uma atividade já revisada não é revisada de novo ---------
CREATE OR REPLACE FUNCTION public.ops_reviews_apply()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_act public.ops_activities%ROWTYPE;
  v_new uuid;
BEGIN
  -- Trava a atividade: dois "Refazer" ao mesmo tempo criavam dois retrabalhos.
  SELECT * INTO v_act FROM public.ops_activities WHERE id = NEW.activity_id FOR UPDATE;
  IF v_act.status IN ('aprovada', 'refazer') THEN
    RAISE EXCEPTION 'Esta atividade já foi revisada' USING ERRCODE = '23514';
  END IF;
  IF NEW.result = 'aprovado' THEN
    UPDATE public.ops_activities SET status = 'aprovada' WHERE id = NEW.activity_id;
  ELSE
    INSERT INTO public.ops_activities (
      project_id, stage_id, title, description, responsible_user_id, fornecedor_id,
      is_critical, status, rework_of_id, sort_order
    ) VALUES (
      v_act.project_id,
      coalesce(v_act.stage_id, (SELECT stage_id FROM public.ops_activities WHERE id = v_act.rework_of_id)),
      'Refazer: ' || regexp_replace(v_act.title, '^Refazer: ', ''),
      NEW.notes,
      v_act.responsible_user_id,
      v_act.fornecedor_id,
      v_act.is_critical,
      'planejada',
      v_act.id,
      v_act.sort_order
    ) RETURNING id INTO v_new;
    UPDATE public.ops_activities SET status = 'refazer' WHERE id = NEW.activity_id;
    NEW.rework_activity_id := v_new;
  END IF;
  RETURN NEW;
END $$;

-- 5) Ponte por etapa: % calculado por atividade -----------------------
-- Mesmas colunas, na mesma ordem e com os mesmos tipos. Só muda pct_done:
--   - atividade concluída/aprovada vale 100%;
--   - atividade em andamento vale dias feitos ÷ dias que ainda contam
--     (o "não feito" sai do denominador: o dia foi perdido, não é trabalho
--     que falta para sempre);
--   - atividade sem dia marcado vale 0% (antes era ignorada);
--   - a atividade marcada "refazer" não conta: quem conta é o retrabalho.
CREATE OR REPLACE VIEW public.v_stage_rollup
WITH (security_invoker = true) AS
SELECT
  s.id                                                         AS stage_id,
  s.project_id,
  s.description                                                AS stage_name,
  s.sort_order                                                 AS stage_sort_order,
  count(a.id)                                                  AS activities_total,
  count(a.id) FILTER (WHERE a.status IN ('concluida', 'aprovada')) AS activities_done,
  count(a.id) FILTER (WHERE a.status = 'refazer')              AS activities_rework,
  count(a.id) FILTER (WHERE a.status = 'bloqueada')            AS activities_blocked,
  coalesce(sum(v.assignments_total), 0)::int                   AS assignments_total,
  coalesce(sum(v.assignments_done), 0)::int                    AS assignments_done,
  coalesce(sum(v.assignments_not_done), 0)::int                AS assignments_not_done,
  coalesce(sum(v.materials_missing), 0)::int                   AS materials_missing,
  CASE
    WHEN count(a.id) FILTER (WHERE a.status <> 'refazer') > 0
      THEN round(
        100.0 * sum(
          CASE
            WHEN a.status = 'refazer' THEN 0
            WHEN a.status IN ('concluida', 'aprovada') THEN 1
            WHEN coalesce(v.assignments_total, 0) - coalesce(v.assignments_not_done, 0) > 0
              THEN least(1.0, coalesce(v.assignments_done, 0)::numeric
                              / (v.assignments_total - coalesce(v.assignments_not_done, 0)))
            ELSE 0
          END
        ) / count(a.id) FILTER (WHERE a.status <> 'refazer'),
        1)
  END                                                          AS pct_done,
  (SELECT min(x.work_date) FROM public.ops_assignments x
     JOIN public.ops_activities y ON y.id = x.activity_id
    WHERE y.stage_id = s.id AND x.outcome = 'feito')           AS first_done_date,
  (SELECT max(x.work_date) FROM public.ops_assignments x
     JOIN public.ops_activities y ON y.id = x.activity_id
    WHERE y.stage_id = s.id AND x.outcome = 'feito')           AS last_done_date,
  bool_or(a.status = 'bloqueada' AND a.blocked_reason = 'cliente_decisao') AS has_customer_block
FROM public.project_activities s
LEFT JOIN public.ops_activities a ON a.stage_id = s.id
LEFT JOIN public.v_ops_activities v ON v.id = a.id
WHERE public.is_staff(auth.uid())
GROUP BY s.id, s.project_id, s.description, s.sort_order;

GRANT SELECT ON public.v_stage_rollup TO authenticated;

-- 6) "Hoje" do aditivo no fuso de São Paulo ---------------------------
ALTER TABLE public.contract_term_amendments
  ALTER COLUMN event_date SET DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date);

-- 7) Limite de sanidade nos dias úteis do contrato ---------------------
-- NOT VALID: vale para o que for gravado daqui em diante, sem falhar a
-- migration se existir alguma linha antiga fora do limite.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'projects_contract_business_days_max_chk'
      AND conrelid = 'public.projects'::regclass
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_contract_business_days_max_chk
      CHECK (contract_business_days IS NULL OR contract_business_days <= 1500) NOT VALID;
  END IF;
END $$;

-- 8) Índices -----------------------------------------------------------
CREATE INDEX IF NOT EXISTS ops_activities_stage_idx ON public.ops_activities (stage_id) WHERE stage_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ops_activities_rework_of_idx ON public.ops_activities (rework_of_id) WHERE rework_of_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ops_activities_fornecedor_idx ON public.ops_activities (fornecedor_id) WHERE fornecedor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ops_assignments_work_date_idx ON public.ops_assignments (work_date);
CREATE INDEX IF NOT EXISTS ops_assignments_fornecedor_idx ON public.ops_assignments (fornecedor_id) WHERE fornecedor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ops_materials_purchase_idx ON public.ops_materials (purchase_id) WHERE purchase_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ops_reviews_rework_activity_idx ON public.ops_reviews (rework_activity_id) WHERE rework_activity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS contract_term_amendments_formalization_idx
  ON public.contract_term_amendments (formalization_id) WHERE formalization_id IS NOT NULL;
