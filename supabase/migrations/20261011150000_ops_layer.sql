-- =====================================================================
-- Fase 2 da reformulação do processo core: CAMADA DE OPERAÇÃO
--
-- O dia a dia da equipe (o que será feito, por quem, em que dia, se foi
-- feito, qual material precisa estar na obra, se ficou bom ou teve que voltar)
-- passa a viver em tabelas próprias, 100% staff, penduradas nas ETAPAS que o
-- cliente já vê (`project_activities`). A camada do cliente não muda: ele
-- continua vendo só o macro. A ponte é a view `v_stage_rollup`.
--
--   ops_activities   atividade da equipe dentro de uma etapa
--   ops_assignments  quem faz em qual dia + Feito / Não feito
--   ops_materials    material que precisa estar na obra para a atividade
--   ops_reviews      aprovado / refazer (refazer cria nova atividade)
--
-- RLS: somente staff com acesso à obra. Nenhuma policy para cliente.
-- Idempotente.
-- =====================================================================

-- 1) Enums ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.ops_activity_status AS ENUM
    ('planejada', 'pronta', 'em_execucao', 'concluida', 'aprovada', 'refazer', 'bloqueada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ops_block_reason AS ENUM
    ('material', 'equipe', 'cliente_decisao', 'condominio', 'projeto', 'clima', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ops_assignment_outcome AS ENUM ('feito', 'nao_feito');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ops_material_status AS ENUM ('pendente', 'comprado', 'na_obra');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ops_review_result AS ENUM ('aprovado', 'refazer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Tabelas ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ops_activities (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  -- Etapa do cliente. Obrigatória na criação (trigger); se a etapa for apagada
  -- no cronograma, a atividade fica "sem etapa" em vez de perder o histórico.
  stage_id            uuid REFERENCES public.project_activities(id) ON DELETE SET NULL,
  title               text NOT NULL CHECK (length(btrim(title)) > 0),
  description         text,
  responsible_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  fornecedor_id       uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  planned_start       date,
  planned_end         date,
  late_finish         date,          -- data-limite (calculada nas próximas fases)
  is_critical         boolean NOT NULL DEFAULT false,
  planned_cost        numeric(14,2) CHECK (planned_cost IS NULL OR planned_cost >= 0),
  actual_cost         numeric(14,2) CHECK (actual_cost IS NULL OR actual_cost >= 0),
  status              public.ops_activity_status NOT NULL DEFAULT 'planejada',
  blocked_reason      public.ops_block_reason,
  rework_of_id        uuid REFERENCES public.ops_activities(id) ON DELETE SET NULL,
  sort_order          integer NOT NULL DEFAULT 0,
  created_by          uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ops_activities_dates_chk CHECK (planned_end IS NULL OR planned_start IS NULL OR planned_end >= planned_start),
  CONSTRAINT ops_activities_blocked_chk CHECK (status <> 'bloqueada' OR blocked_reason IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.ops_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id     uuid NOT NULL REFERENCES public.ops_activities(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE, -- preenchido por trigger
  work_date       date NOT NULL,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  fornecedor_id   uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  worker_name     text,
  outcome         public.ops_assignment_outcome,  -- NULL = ainda não confirmado
  not_done_reason public.ops_block_reason,
  notes           text,
  photo_paths     text[] NOT NULL DEFAULT '{}',
  done_at         timestamptz,
  done_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by      uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ops_assignments_who_chk CHECK (
    user_id IS NOT NULL OR fornecedor_id IS NOT NULL OR nullif(btrim(worker_name), '') IS NOT NULL
  ),
  CONSTRAINT ops_assignments_reason_chk CHECK (outcome IS DISTINCT FROM 'nao_feito' OR not_done_reason IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.ops_materials (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id  uuid NOT NULL REFERENCES public.ops_activities(id) ON DELETE CASCADE,
  project_id   uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE, -- preenchido por trigger
  description  text NOT NULL CHECK (length(btrim(description)) > 0),
  quantity     numeric(14,3) CHECK (quantity IS NULL OR quantity > 0),
  unit         text,
  needed_by    date,
  purchase_id  uuid REFERENCES public.project_purchases(id) ON DELETE SET NULL,
  status       public.ops_material_status NOT NULL DEFAULT 'pendente',
  created_by   uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ops_reviews (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id        uuid NOT NULL REFERENCES public.ops_activities(id) ON DELETE CASCADE,
  project_id         uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE, -- preenchido por trigger
  result             public.ops_review_result NOT NULL,
  notes              text,
  photo_paths        text[] NOT NULL DEFAULT '{}',
  rework_activity_id uuid REFERENCES public.ops_activities(id) ON DELETE SET NULL, -- preenchido por trigger
  reviewed_by        uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ops_reviews_refazer_notes_chk CHECK (result <> 'refazer' OR nullif(btrim(notes), '') IS NOT NULL)
);

-- 3) Índices ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS ops_activities_project_stage_idx ON public.ops_activities (project_id, stage_id, sort_order);
CREATE INDEX IF NOT EXISTS ops_activities_responsible_idx ON public.ops_activities (responsible_user_id) WHERE responsible_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ops_assignments_project_date_idx ON public.ops_assignments (project_id, work_date);
CREATE INDEX IF NOT EXISTS ops_assignments_activity_idx ON public.ops_assignments (activity_id, work_date);
CREATE INDEX IF NOT EXISTS ops_assignments_user_date_idx ON public.ops_assignments (user_id, work_date) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ops_materials_activity_idx ON public.ops_materials (activity_id);
CREATE INDEX IF NOT EXISTS ops_materials_project_status_idx ON public.ops_materials (project_id, status);
CREATE INDEX IF NOT EXISTS ops_reviews_activity_idx ON public.ops_reviews (activity_id, created_at DESC);

-- 4) Triggers ---------------------------------------------------------
-- 4a) Atividade: etapa obrigatória na criação e sempre da mesma obra.
CREATE OR REPLACE FUNCTION public.ops_activities_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_stage_project uuid;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.stage_id IS NULL THEN
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

DROP TRIGGER IF EXISTS ops_activities_validate_trg ON public.ops_activities;
CREATE TRIGGER ops_activities_validate_trg
  BEFORE INSERT OR UPDATE ON public.ops_activities
  FOR EACH ROW EXECUTE FUNCTION public.ops_activities_validate();

-- 4b) Filhas herdam project_id da atividade (RLS rápido, sem join).
CREATE OR REPLACE FUNCTION public.ops_child_set_project()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_project uuid;
BEGIN
  SELECT project_id INTO v_project FROM public.ops_activities WHERE id = NEW.activity_id;
  IF v_project IS NULL THEN
    RAISE EXCEPTION 'Atividade não encontrada' USING ERRCODE = '23503';
  END IF;
  NEW.project_id := v_project;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS ops_assignments_set_project_trg ON public.ops_assignments;
CREATE TRIGGER ops_assignments_set_project_trg
  BEFORE INSERT OR UPDATE OF activity_id ON public.ops_assignments
  FOR EACH ROW EXECUTE FUNCTION public.ops_child_set_project();

DROP TRIGGER IF EXISTS ops_materials_set_project_trg ON public.ops_materials;
CREATE TRIGGER ops_materials_set_project_trg
  BEFORE INSERT OR UPDATE OF activity_id ON public.ops_materials
  FOR EACH ROW EXECUTE FUNCTION public.ops_child_set_project();

DROP TRIGGER IF EXISTS ops_reviews_set_project_trg ON public.ops_reviews;
CREATE TRIGGER ops_reviews_set_project_trg
  BEFORE INSERT ON public.ops_reviews
  FOR EACH ROW EXECUTE FUNCTION public.ops_child_set_project();

-- 4c) Feito / Não feito: carimba quem e quando; o primeiro "feito" coloca a
-- atividade em execução (um toque a menos para o gestor).
CREATE OR REPLACE FUNCTION public.ops_assignments_stamp()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.outcome IS DISTINCT FROM OLD.outcome THEN
    IF NEW.outcome IS NULL THEN
      NEW.done_at := NULL;
      NEW.done_by := NULL;
    ELSE
      NEW.done_at := now();
      NEW.done_by := auth.uid();
    END IF;
  END IF;
  IF NEW.outcome = 'feito' THEN
    NEW.not_done_reason := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS ops_assignments_stamp_trg ON public.ops_assignments;
CREATE TRIGGER ops_assignments_stamp_trg
  BEFORE INSERT OR UPDATE ON public.ops_assignments
  FOR EACH ROW EXECUTE FUNCTION public.ops_assignments_stamp();

CREATE OR REPLACE FUNCTION public.ops_assignments_advance_activity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.outcome = 'feito' AND (TG_OP = 'INSERT' OR OLD.outcome IS DISTINCT FROM 'feito') THEN
    UPDATE public.ops_activities
       SET status = 'em_execucao'
     WHERE id = NEW.activity_id
       AND status IN ('planejada', 'pronta');
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS ops_assignments_advance_trg ON public.ops_assignments;
CREATE TRIGGER ops_assignments_advance_trg
  AFTER INSERT OR UPDATE OF outcome ON public.ops_assignments
  FOR EACH ROW EXECUTE FUNCTION public.ops_assignments_advance_activity();

-- 4d) Revisão: aprovado fecha a atividade; refazer marca a original e cria a
-- atividade de retrabalho na mesma etapa (consome folga no mesmo dia).
CREATE OR REPLACE FUNCTION public.ops_reviews_apply()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_act public.ops_activities%ROWTYPE;
  v_new uuid;
BEGIN
  SELECT * INTO v_act FROM public.ops_activities WHERE id = NEW.activity_id;
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

DROP TRIGGER IF EXISTS ops_reviews_apply_trg ON public.ops_reviews;
CREATE TRIGGER ops_reviews_apply_trg
  BEFORE INSERT ON public.ops_reviews
  FOR EACH ROW EXECUTE FUNCTION public.ops_reviews_apply();

-- 4e) updated_at
DROP TRIGGER IF EXISTS update_ops_activities_updated_at ON public.ops_activities;
CREATE TRIGGER update_ops_activities_updated_at BEFORE UPDATE ON public.ops_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_ops_assignments_updated_at ON public.ops_assignments;
CREATE TRIGGER update_ops_assignments_updated_at BEFORE UPDATE ON public.ops_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_ops_materials_updated_at ON public.ops_materials;
CREATE TRIGGER update_ops_materials_updated_at BEFORE UPDATE ON public.ops_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) RLS: somente staff com acesso à obra -----------------------------
ALTER TABLE public.ops_activities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_materials   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_reviews     ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ops_activities', 'ops_assignments', 'ops_materials', 'ops_reviews'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_staff_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), project_id))
         WITH CHECK (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), project_id))',
      t || '_staff_all', t);
  END LOOP;
END $$;

-- Revisão é registro histórico: sem UPDATE/DELETE pelo app (só inserir).
DROP POLICY IF EXISTS ops_reviews_staff_all ON public.ops_reviews;
DROP POLICY IF EXISTS ops_reviews_staff_select ON public.ops_reviews;
CREATE POLICY ops_reviews_staff_select ON public.ops_reviews FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), project_id));
DROP POLICY IF EXISTS ops_reviews_staff_insert ON public.ops_reviews;
CREATE POLICY ops_reviews_staff_insert ON public.ops_reviews FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), project_id));

-- 6) Views (somente staff) -------------------------------------------
-- 6a) Atividade com contadores prontos para as telas Semana e Hoje.
CREATE OR REPLACE VIEW public.v_ops_activities
WITH (security_invoker = true) AS
SELECT
  a.*,
  s.description                                               AS stage_name,
  s.sort_order                                                AS stage_sort_order,
  coalesce(asg.total, 0)                                      AS assignments_total,
  coalesce(asg.done, 0)                                       AS assignments_done,
  coalesce(asg.not_done, 0)                                   AS assignments_not_done,
  coalesce(asg.pending, 0)                                    AS assignments_pending,
  asg.first_work_date,
  asg.last_work_date,
  asg.next_pending_date,
  coalesce(mat.total, 0)                                      AS materials_total,
  coalesce(mat.on_site, 0)                                    AS materials_on_site,
  (coalesce(mat.total, 0) - coalesce(mat.on_site, 0))         AS materials_missing,
  -- "Pronta" = alguém alocado e todo material na obra.
  (coalesce(asg.total, 0) > 0 AND coalesce(mat.total, 0) = coalesce(mat.on_site, 0)) AS is_ready
FROM public.ops_activities a
LEFT JOIN public.project_activities s ON s.id = a.stage_id
LEFT JOIN LATERAL (
  SELECT count(*)                                        AS total,
         count(*) FILTER (WHERE x.outcome = 'feito')     AS done,
         count(*) FILTER (WHERE x.outcome = 'nao_feito') AS not_done,
         count(*) FILTER (WHERE x.outcome IS NULL)       AS pending,
         min(x.work_date)                                AS first_work_date,
         max(x.work_date)                                AS last_work_date,
         min(x.work_date) FILTER (WHERE x.outcome IS NULL) AS next_pending_date
  FROM public.ops_assignments x WHERE x.activity_id = a.id
) asg ON true
LEFT JOIN LATERAL (
  SELECT count(*)                                     AS total,
         count(*) FILTER (WHERE m.status = 'na_obra') AS on_site
  FROM public.ops_materials m WHERE m.activity_id = a.id
) mat ON true
WHERE public.is_staff(auth.uid());

GRANT SELECT ON public.v_ops_activities TO authenticated;

-- 6b) PONTE: resumo por etapa do cliente. É daqui que, nas próximas fases,
-- sai o % e as datas reais publicados para o cliente — nunca nomes ou custos.
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
    WHEN coalesce(sum(v.assignments_total), 0) > 0
      THEN round(100.0 * sum(v.assignments_done) / sum(v.assignments_total), 1)
    WHEN count(a.id) > 0
      THEN round(100.0 * count(a.id) FILTER (WHERE a.status IN ('concluida', 'aprovada')) / count(a.id), 1)
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

COMMENT ON VIEW public.v_ops_activities IS 'Atividades da equipe com contadores de alocação e material (somente staff).';
COMMENT ON VIEW public.v_stage_rollup IS 'Ponte operação → cliente: resumo por etapa (somente staff). Sem nomes nem custos.';
