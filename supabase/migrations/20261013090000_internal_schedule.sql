-- =====================================================================
-- CRONOGRAMA INTERNO separado do cronograma do cliente
--
-- POR QUE ISTO EXISTE
-- Cliente e equipe usavam o MESMO cronograma (`project_activities`). O cliente
-- lê essa tabela pela RLS (has_project_access / project_customers), então
-- tudo o que a equipe fazia nela para tocar a obra — quebrar etapa em
-- micro-etapas, puxar data, trocar prestador, pendurar a camada de operação
-- (Semana / Hoje) — aparecia para o cliente, ou obrigava a equipe a não
-- registrar o que de fato ia fazer. O cronograma do cliente é um compromisso
-- comercial; o interno é a ferramenta de trabalho. Em 13/10/2026 eram 113
-- obras com 1562 atividades de cliente (média 15, máximo 27 por obra, no
-- máximo 2 níveis).
--
-- O QUE FAZ
--   1. `internal_schedule_items`: o cronograma interno, 100% staff. Mesmo
--      formato de `project_activities` (datas, peso, ordem, predecessoras,
--      responsável, prestador, até 2 níveis via parent_id) e
--      `client_activity_id` = a atividade do cliente a que o item corresponde
--      (informativo; apagar a atividade do cliente só zera esse vínculo).
--   2. `copy_client_schedule_to_internal(obra, substituir)`: copia o
--      cronograma do cliente para o interno (ids novos; pai e predecessoras
--      remapeados). Sem `substituir`, obra que já tem cronograma interno não
--      recebe nada (devolve 0). Com `substituir`, a cópia nova entra no lugar
--      da antiga e as atividades da operação que estavam penduradas num item
--      antigo passam para o item novo da mesma atividade do cliente.
--   3. Carga: toda obra não excluída com cronograma do cliente e sem
--      cronograma interno recebe a cópia (mesma função).
--   4. Obra nova: quando o cronograma do cliente nasce, o interno nasce junto,
--      UMA vez. Gatilho de restrição ADIADO (roda no COMMIT): o
--      replace_project_activities grava as atividades uma a uma num laço, e
--      um gatilho comum veria só a primeira. No commit, o primeiro disparo
--      copia o conjunto inteiro e os demais encontram o interno já criado.
--      Depois disso, editar o cronograma do cliente NUNCA muda o interno. O
--      gatilho jamais derruba o salvamento do cliente: qualquer erro vira
--      WARNING.
--   5. Camada de operação: `ops_activities.stage_id` passa a apontar para o
--      item interno (mesmo ON DELETE SET NULL); as linhas existentes são
--      remapeadas pelo client_activity_id (sem correspondente → NULL).
--      `ops_activities_validate`, `v_ops_activities` e `v_stage_rollup`
--      passam a ler o cronograma interno — mesmas colunas, mesmos nomes.
--
-- SEGURANÇA
-- Lê: staff com acesso à obra (is_staff + has_project_access). Grava: quem
-- pode editar cronograma em src/config/permissions.ts ('schedule:edit':
-- admin, manager, engineer, gestor, cs, arquitetura) com acesso à obra —
-- função can_edit_internal_schedule. Financeiro e suprimentos veem, não
-- editam. Nenhuma policy para cliente; anon sem nenhum direito; fora da
-- publicação de realtime. A RPC é SECURITY DEFINER com o mesmo portão; a
-- função de cópia sem portão (_copy_client_schedule_to_internal) não é
-- executável por PUBLIC/anon/authenticated.
--
-- O QUE NÃO MUDA
-- `project_activities`, o editor do cliente, replace_project_activities,
-- reorder_project_activities, save_project_baseline, as policies e tudo o
-- que o cliente vê. sync_project_planned_dates_from_activities continua
-- sincronizando projects.planned_* a partir do cronograma do cliente.
-- project_purchases.activity_id continua apontando para project_activities.
-- Idempotente: rodar duas vezes não copia nada na segunda.
-- =====================================================================

-- 1) Tabela -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.internal_schedule_items (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_id            uuid REFERENCES public.internal_schedule_items(id) ON DELETE CASCADE,
  client_activity_id   uuid REFERENCES public.project_activities(id) ON DELETE SET NULL,
  description          text NOT NULL,
  etapa                text,
  detailed_description text,
  planned_start        date NOT NULL,
  planned_end          date NOT NULL,
  actual_start         date,
  actual_end           date,
  -- mesmo tipo de project_activities.weight
  weight               numeric(5,2) NOT NULL DEFAULT 0,
  sort_order           integer NOT NULL DEFAULT 0,
  predecessor_ids      uuid[] NOT NULL DEFAULT '{}',
  responsible_user_id  uuid REFERENCES public.users_profile(id) ON DELETE SET NULL,
  fornecedor_id        uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  notes                text,
  created_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT internal_schedule_items_description_chk CHECK (length(btrim(description)) > 0),
  CONSTRAINT internal_schedule_items_planned_dates_chk CHECK (planned_end >= planned_start),
  CONSTRAINT internal_schedule_items_actual_dates_chk
    CHECK (actual_end IS NULL OR actual_start IS NULL OR actual_end >= actual_start),
  CONSTRAINT internal_schedule_items_weight_chk CHECK (weight >= 0 AND weight <= 100),
  CONSTRAINT internal_schedule_items_not_own_parent_chk CHECK (parent_id IS DISTINCT FROM id)
);

CREATE INDEX IF NOT EXISTS internal_schedule_items_project_sort_idx
  ON public.internal_schedule_items (project_id, sort_order);
CREATE INDEX IF NOT EXISTS internal_schedule_items_parent_idx
  ON public.internal_schedule_items (parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS internal_schedule_items_client_activity_idx
  ON public.internal_schedule_items (client_activity_id) WHERE client_activity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS internal_schedule_items_responsible_idx
  ON public.internal_schedule_items (responsible_user_id) WHERE responsible_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS internal_schedule_items_fornecedor_idx
  ON public.internal_schedule_items (fornecedor_id) WHERE fornecedor_id IS NOT NULL;

COMMENT ON TABLE public.internal_schedule_items IS
  'Cronograma interno da obra (somente staff). Nasce como cópia do cronograma do cliente (project_activities) e depois evolui sozinho.';
COMMENT ON COLUMN public.internal_schedule_items.client_activity_id IS
  'Atividade do cronograma do cliente a que este item corresponde (informativo). Apagar a atividade do cliente só zera o vínculo.';
COMMENT ON COLUMN public.internal_schedule_items.parent_id IS
  'Item-pai (micro-etapa). Mesma obra, no máximo 2 níveis.';
COMMENT ON COLUMN public.internal_schedule_items.updated_by IS 'Quem gravou por último (preenchido pelo banco).';

-- 2) Quem pode gravar ---------------------------------------------------
-- Mesmos papéis de 'schedule:edit' (src/config/permissions.ts). SECURITY
-- DEFINER porque as policies rodam como o usuário, que não lê user_roles de
-- outras pessoas.
CREATE OR REPLACE FUNCTION public.can_edit_internal_schedule(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _user_id
       AND role IN ('admin', 'manager', 'engineer', 'gestor', 'cs', 'arquitetura')
  );
$$;

REVOKE ALL ON FUNCTION public.can_edit_internal_schedule(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_internal_schedule(uuid) TO authenticated, service_role;

-- 3) Antes de gravar: normaliza e carimba --------------------------------
CREATE OR REPLACE FUNCTION public.internal_schedule_items_before_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  -- colunas que as FKs zeram sozinhas (ON DELETE SET NULL)
  c_fk_cols constant text[] := ARRAY['created_by', 'updated_by', 'responsible_user_id',
                                     'fornecedor_id', 'client_activity_id'];
  v_new jsonb;
  v_old jsonb;
BEGIN
  -- Apagar o usuário, o perfil, o prestador ou a atividade do cliente zera a
  -- coluna pela FK. Isso não é uma edição: a linha fica como está, sem novo
  -- carimbo — e sem recolocar um usuário que está sendo apagado em
  -- created_by/updated_by, o que faria a exclusão falhar. Reconhecemos o caso
  -- por ser um UPDATE vindo de dentro de outro gatilho (o da FK) que só
  -- esvazia essas colunas.
  IF TG_OP = 'UPDATE' AND pg_trigger_depth() > 1 THEN
    v_new := to_jsonb(NEW);
    v_old := to_jsonb(OLD);
    IF (v_new - c_fk_cols) = (v_old - c_fk_cols)
       AND v_new IS DISTINCT FROM v_old
       AND NOT EXISTS (
         SELECT 1 FROM unnest(c_fk_cols) k
          WHERE v_new -> k <> 'null'::jsonb
            AND (v_new -> k) IS DISTINCT FROM (v_old -> k)
       ) THEN
      RETURN NEW;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    RAISE EXCEPTION 'Não é possível mover um item do cronograma interno para outra obra' USING ERRCODE = '23514';
  END IF;

  NEW.description          := btrim(NEW.description);
  NEW.etapa                := nullif(btrim(NEW.etapa), '');
  NEW.detailed_description := nullif(btrim(NEW.detailed_description), '');
  NEW.notes                := nullif(btrim(NEW.notes), '');
  NEW.predecessor_ids      := coalesce(NEW.predecessor_ids, '{}'::uuid[]);
  NEW.updated_at           := now();
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    NEW.created_by := auth.uid();
    NEW.updated_by := auth.uid();
  ELSE
    NEW.created_at := OLD.created_at;
    NEW.created_by := OLD.created_by;
    -- Sem usuário na sessão (rotina do banco, service role): mantém quem
    -- gravou por último em vez de apagar a autoria.
    NEW.updated_by := coalesce(auth.uid(), OLD.updated_by);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS internal_schedule_items_before_write_trg ON public.internal_schedule_items;
CREATE TRIGGER internal_schedule_items_before_write_trg
  BEFORE INSERT OR UPDATE ON public.internal_schedule_items
  FOR EACH ROW EXECUTE FUNCTION public.internal_schedule_items_before_write();

-- 4) Pai: mesma obra, no máximo 2 níveis ----------------------------------
-- Mesma ideia de validate_project_activity_parent (20260422041552), mais a
-- regra dos 2 níveis: o pai não pode ter pai, e quem tem filhos não vira filho.
CREATE OR REPLACE FUNCTION public.validate_internal_schedule_parent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_project uuid;
  v_parent_parent  uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Um item não pode ser pai dele mesmo' USING ERRCODE = '23514';
  END IF;

  SELECT project_id, parent_id INTO v_parent_project, v_parent_parent
    FROM public.internal_schedule_items
   WHERE id = NEW.parent_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item-pai % não encontrado', NEW.parent_id USING ERRCODE = '23503';
  END IF;
  IF v_parent_project IS DISTINCT FROM NEW.project_id THEN
    RAISE EXCEPTION 'O item-pai deve pertencer à mesma obra' USING ERRCODE = '23514';
  END IF;
  IF v_parent_parent IS NOT NULL THEN
    RAISE EXCEPTION 'O cronograma interno tem no máximo 2 níveis: o item-pai já é uma micro-etapa' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.internal_schedule_items WHERE parent_id = NEW.id) THEN
    RAISE EXCEPTION 'O cronograma interno tem no máximo 2 níveis: este item já tem micro-etapas' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_internal_schedule_parent() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_internal_schedule_parent ON public.internal_schedule_items;
CREATE TRIGGER trg_validate_internal_schedule_parent
  BEFORE INSERT OR UPDATE OF parent_id, project_id ON public.internal_schedule_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_internal_schedule_parent();

-- 5) RLS: somente staff com acesso à obra ----------------------------------
ALTER TABLE public.internal_schedule_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.internal_schedule_items FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.internal_schedule_items TO authenticated;
GRANT ALL ON TABLE public.internal_schedule_items TO service_role;

DROP POLICY IF EXISTS internal_schedule_items_staff_select ON public.internal_schedule_items;
CREATE POLICY internal_schedule_items_staff_select ON public.internal_schedule_items
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), project_id));

DROP POLICY IF EXISTS internal_schedule_items_editor_insert ON public.internal_schedule_items;
CREATE POLICY internal_schedule_items_editor_insert ON public.internal_schedule_items
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_internal_schedule(auth.uid()) AND public.has_project_access(auth.uid(), project_id));

DROP POLICY IF EXISTS internal_schedule_items_editor_update ON public.internal_schedule_items;
CREATE POLICY internal_schedule_items_editor_update ON public.internal_schedule_items
  FOR UPDATE TO authenticated
  USING (public.can_edit_internal_schedule(auth.uid()) AND public.has_project_access(auth.uid(), project_id))
  WITH CHECK (public.can_edit_internal_schedule(auth.uid()) AND public.has_project_access(auth.uid(), project_id));

DROP POLICY IF EXISTS internal_schedule_items_editor_delete ON public.internal_schedule_items;
CREATE POLICY internal_schedule_items_editor_delete ON public.internal_schedule_items
  FOR DELETE TO authenticated
  USING (public.can_edit_internal_schedule(auth.uid()) AND public.has_project_access(auth.uid(), project_id));

-- 6) Cópia cliente → interno ---------------------------------------------------
-- Sem portão de permissão: usada pela RPC (que tem o portão), pela carga
-- abaixo e pelo gatilho de obra nova. Ninguém do app executa direto.
CREATE OR REPLACE FUNCTION public._copy_client_schedule_to_internal(p_project_id uuid, p_replace boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_map     jsonb;     -- id da atividade do cliente → id novo do item interno
  v_root    jsonb;     -- micro-etapa do cliente → atividade raiz dela
  v_old_ids uuid[];
  v_top     integer := 0;
  v_child   integer := 0;
BEGIN
  IF p_project_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Uma cópia por obra de cada vez (duas abas salvando o primeiro
  -- cronograma ao mesmo tempo não podem gerar duas cópias).
  PERFORM pg_advisory_xact_lock(hashtextextended('internal_schedule:' || p_project_id::text, 0));

  SELECT array_agg(id) INTO v_old_ids
    FROM public.internal_schedule_items
   WHERE project_id = p_project_id;

  IF v_old_ids IS NOT NULL AND NOT coalesce(p_replace, false) THEN
    RETURN 0;
  END IF;

  SELECT jsonb_object_agg(a.id::text, gen_random_uuid())
    INTO v_map
    FROM public.project_activities a
   WHERE a.project_id = p_project_id;

  -- Cronograma do cliente vazio: nada a copiar — e "substituir por nada"
  -- não apaga o interno.
  IF v_map IS NULL THEN
    RETURN 0;
  END IF;

  -- Micro-etapas e a raiz de cada uma. Mais de 2 níveis (não existe hoje) é
  -- achatado: a micro-etapa fica pendurada na raiz. Ciclo (não deveria
  -- existir) vira item de primeiro nível.
  WITH RECURSIVE tree AS (
    SELECT a.id, 0 AS depth, a.id AS root
      FROM public.project_activities a
     WHERE a.project_id = p_project_id AND a.parent_activity_id IS NULL
    UNION ALL
    SELECT c.id, t.depth + 1, t.root
      FROM public.project_activities c
      JOIN tree t ON c.parent_activity_id = t.id
     WHERE c.project_id = p_project_id AND t.depth < 50
  )
  SELECT coalesce(jsonb_object_agg(t.id::text, t.root) FILTER (WHERE t.depth > 0), '{}'::jsonb)
    INTO v_root
    FROM tree t;

  -- Primeiro nível primeiro (o gatilho de pai exige o pai já gravado).
  INSERT INTO public.internal_schedule_items (
    id, project_id, parent_id, client_activity_id, description, etapa, detailed_description,
    planned_start, planned_end, actual_start, actual_end, weight, sort_order,
    predecessor_ids, responsible_user_id, fornecedor_id
  )
  SELECT
    (v_map ->> a.id::text)::uuid,
    a.project_id,
    NULL,
    a.id,
    coalesce(nullif(btrim(a.description), ''), 'Atividade'),
    a.etapa,
    a.detailed_description,
    a.planned_start,
    a.planned_end,
    a.actual_start,
    a.actual_end,
    a.weight,
    a.sort_order,
    coalesce((
      SELECT array_agg((v_map ->> p.pid::text)::uuid ORDER BY p.ord)
        FROM unnest(a.predecessor_ids) WITH ORDINALITY AS p(pid, ord)
       WHERE v_map ? p.pid::text
    ), '{}'::uuid[]),
    a.responsible_user_id,
    a.fornecedor_id
  FROM public.project_activities a
  WHERE a.project_id = p_project_id
    AND NOT (v_root ? a.id::text)
  ORDER BY a.sort_order, a.planned_start, a.id;
  GET DIAGNOSTICS v_top = ROW_COUNT;

  INSERT INTO public.internal_schedule_items (
    id, project_id, parent_id, client_activity_id, description, etapa, detailed_description,
    planned_start, planned_end, actual_start, actual_end, weight, sort_order,
    predecessor_ids, responsible_user_id, fornecedor_id
  )
  SELECT
    (v_map ->> a.id::text)::uuid,
    a.project_id,
    (v_map ->> (v_root ->> a.id::text))::uuid,
    a.id,
    coalesce(nullif(btrim(a.description), ''), 'Atividade'),
    a.etapa,
    a.detailed_description,
    a.planned_start,
    a.planned_end,
    a.actual_start,
    a.actual_end,
    a.weight,
    a.sort_order,
    coalesce((
      SELECT array_agg((v_map ->> p.pid::text)::uuid ORDER BY p.ord)
        FROM unnest(a.predecessor_ids) WITH ORDINALITY AS p(pid, ord)
       WHERE v_map ? p.pid::text
    ), '{}'::uuid[]),
    a.responsible_user_id,
    a.fornecedor_id
  FROM public.project_activities a
  WHERE a.project_id = p_project_id
    AND v_root ? a.id::text
  ORDER BY a.sort_order, a.planned_start, a.id;
  GET DIAGNOSTICS v_child = ROW_COUNT;

  IF v_old_ids IS NOT NULL THEN
    -- Substituição: a operação pendurada num item antigo passa para o item
    -- novo da mesma atividade do cliente (se não houver, fica sem etapa,
    -- como quando se apaga uma etapa).
    UPDATE public.ops_activities o
       SET stage_id = (v_map ->> old.client_activity_id::text)::uuid
      FROM public.internal_schedule_items old
     WHERE old.id = o.stage_id
       AND old.id = ANY (v_old_ids)
       AND old.client_activity_id IS NOT NULL
       AND v_map ? old.client_activity_id::text;

    DELETE FROM public.internal_schedule_items WHERE id = ANY (v_old_ids);
  END IF;

  RETURN v_top + v_child;
END;
$$;

REVOKE ALL ON FUNCTION public._copy_client_schedule_to_internal(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._copy_client_schedule_to_internal(uuid, boolean) TO service_role;

-- RPC para a tela: "copiar o cronograma do cliente" (ou recomeçar dele).
CREATE OR REPLACE FUNCTION public.copy_client_schedule_to_internal(p_project_id uuid, p_replace boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.can_edit_internal_schedule(auth.uid())
     OR NOT public.has_project_access(auth.uid(), p_project_id) THEN
    RAISE EXCEPTION 'Sem permissão para editar o cronograma interno desta obra' USING ERRCODE = '42501';
  END IF;

  RETURN public._copy_client_schedule_to_internal(p_project_id, coalesce(p_replace, false));
END;
$$;

REVOKE ALL ON FUNCTION public.copy_client_schedule_to_internal(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copy_client_schedule_to_internal(uuid, boolean) TO authenticated, service_role;

COMMENT ON FUNCTION public.copy_client_schedule_to_internal(uuid, boolean) IS
  'Copia o cronograma do cliente para o interno (ids novos, pai/predecessoras remapeados). p_replace=false: obra com cronograma interno não recebe nada (0). p_replace=true: substitui o interno. Devolve quantos itens foram copiados.';

-- 7) Carga: obras com cronograma do cliente e sem cronograma interno ----------
DO $$
DECLARE
  v_project uuid;
  v_projects integer := 0;
  v_items integer := 0;
  v_n integer;
BEGIN
  FOR v_project IN
    SELECT p.id
      FROM public.projects p
     WHERE p.deleted_at IS NULL
       AND EXISTS (SELECT 1 FROM public.project_activities a WHERE a.project_id = p.id)
       AND NOT EXISTS (SELECT 1 FROM public.internal_schedule_items i WHERE i.project_id = p.id)
     ORDER BY p.created_at, p.id
  LOOP
    v_n := public._copy_client_schedule_to_internal(v_project, false);
    v_items := v_items + v_n;
    IF v_n > 0 THEN v_projects := v_projects + 1; END IF;
  END LOOP;
  RAISE NOTICE 'Cronograma interno: % item(ns) copiado(s) em % obra(s)', v_items, v_projects;
END $$;

-- 8) Obra nova: o interno nasce com o primeiro cronograma do cliente ---------
-- Gatilho de restrição ADIADO: dispara no COMMIT, quando o cronograma do
-- cliente já está completo (replace_project_activities grava linha a linha).
-- O primeiro disparo da obra copia tudo; os demais veem o interno e saem.
-- Nada aqui pode impedir o salvamento do cliente: erro vira WARNING.
CREATE OR REPLACE FUNCTION public.project_activities_seed_internal_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.internal_schedule_items WHERE project_id = NEW.project_id) THEN
    RETURN NULL;
  END IF;
  BEGIN
    PERFORM public._copy_client_schedule_to_internal(NEW.project_id, false);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Cronograma interno da obra % não foi criado: % (%)', NEW.project_id, SQLERRM, SQLSTATE;
  END;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.project_activities_seed_internal_schedule() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS project_activities_seed_internal_schedule_trg ON public.project_activities;
CREATE CONSTRAINT TRIGGER project_activities_seed_internal_schedule_trg
  AFTER INSERT ON public.project_activities
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.project_activities_seed_internal_schedule();

-- 9) Camada de operação passa a pendurar no cronograma interno ----------------
-- 9a) Validação: a etapa é um item interno da mesma obra.
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
    SELECT project_id INTO v_stage_project FROM public.internal_schedule_items WHERE id = NEW.stage_id;
    IF v_stage_project IS DISTINCT FROM NEW.project_id THEN
      RAISE EXCEPTION 'A etapa informada pertence a outra obra' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.status <> 'bloqueada' THEN
    NEW.blocked_reason := NULL;
  END IF;
  RETURN NEW;
END $$;

-- 9b) FK: troca o alvo e remapeia as linhas existentes (só na primeira vez).
DO $$
DECLARE
  v_con text;
BEGIN
  SELECT c.conname INTO v_con
    FROM pg_constraint c
   WHERE c.conrelid = 'public.ops_activities'::regclass
     AND c.contype = 'f'
     AND c.confrelid = 'public.project_activities'::regclass
     AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute
                            WHERE attrelid = 'public.ops_activities'::regclass
                              AND attname = 'stage_id')]::int2[];

  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.ops_activities DROP CONSTRAINT %I', v_con);

    UPDATE public.ops_activities o
       SET stage_id = (
         SELECT i.id FROM public.internal_schedule_items i
          WHERE i.client_activity_id = o.stage_id
            AND i.project_id = o.project_id
          ORDER BY i.created_at, i.id
          LIMIT 1)
     WHERE o.stage_id IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.ops_activities'::regclass
       AND conname = 'ops_activities_stage_id_fkey'
  ) THEN
    ALTER TABLE public.ops_activities
      ADD CONSTRAINT ops_activities_stage_id_fkey
      FOREIGN KEY (stage_id) REFERENCES public.internal_schedule_items(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.ops_activities.stage_id IS
  'Item do cronograma interno (internal_schedule_items) a que a atividade pertence. Apagar o item deixa a atividade "sem etapa".';

-- 9c) Views: mesmas colunas, lendo o cronograma interno.
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
LEFT JOIN public.internal_schedule_items s ON s.id = a.stage_id
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
REVOKE ALL ON public.v_ops_activities FROM anon;

-- Mesmo cálculo de 20261011190000 (pct por atividade); só a origem das
-- etapas muda para o cronograma interno.
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
FROM public.internal_schedule_items s
LEFT JOIN public.ops_activities a ON a.stage_id = s.id
LEFT JOIN public.v_ops_activities v ON v.id = a.id
WHERE public.is_staff(auth.uid())
GROUP BY s.id, s.project_id, s.description, s.sort_order;

GRANT SELECT ON public.v_stage_rollup TO authenticated;
REVOKE ALL ON public.v_stage_rollup FROM anon;

COMMENT ON VIEW public.v_ops_activities IS
  'Atividades da equipe com contadores de alocação e material (somente staff). Etapa = item do cronograma interno.';
COMMENT ON VIEW public.v_stage_rollup IS
  'Resumo da operação por item do cronograma interno (somente staff). Sem nomes nem custos.';
