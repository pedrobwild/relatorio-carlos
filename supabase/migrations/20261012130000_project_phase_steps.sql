-- =====================================================================
-- FASE DE PROJETO como um fluxo só, com responsável e prazo por etapa
--
-- POR QUE ISTO EXISTE
-- A fase antes da obra (projects.is_project_phase = true) era acompanhada em
-- três lugares que não conversavam: o card do Painel (projects.painel_etapa),
-- a Jornada do cliente (journey_stages) e datas soltas em projects
-- (date_approval_3d, date_approval_exec, date_approval_obra,
-- date_official_start). Nenhum deles tinha responsável nem prazo por etapa, e
-- a regra da empresa — "o início oficial do cronograma é 5 dias úteis depois
-- de recebido o e-mail de aprovação do condomínio" — não estava em lugar
-- nenhum. Em 12/10/2026, 26 das 32 obras ativas em fase de projeto não tinham
-- etapa nenhuma.
--
-- O QUE FAZ
--   1. `project_phase_steps`: uma linha por obra × etapa, com responsável,
--      prazo, data em que foi concluída e observação. As seis etapas, nesta
--      ordem: Projeto 3D → Projeto executivo → Medição fina in loco → Emissão
--      da ART/RRT → Pedido de aprovação ao condomínio → Aprovação do
--      condomínio recebida. As linhas nascem sob demanda: obra sem linha =
--      nada registrado ainda.
--   2. Um gatilho mantém os campos antigos coerentes enquanto a obra está em
--      fase de projeto: etapa do Painel, datas de aprovação e — ao registrar a
--      aprovação do condomínio — o início oficial (5 dias úteis depois) e o
--      início do prazo contratual, sem nunca passar por cima de termos de
--      contrato já conferidos.
--   3. `move_project_to_phase_step`: "esta obra está NA etapa X" — conclui as
--      anteriores e reabre X e as seguintes, numa transação.
--   4. Quando a Jornada do cliente conclui Projeto 3D, Projeto Executivo ou
--      Medição Técnica, a etapa interna correspondente é marcada como
--      concluída (só nesse sentido; nunca o contrário).
--
-- "Executivo Aprovado": o fluxo novo não usa essa etapa do Painel, mas é a
-- entrada nela que avisa o financeiro (trg_notify_executivo_aprovado: sino +
-- e-mail). Para o aviso continuar saindo, concluir o Projeto executivo faz o
-- card PASSAR por "Executivo Aprovado" antes de seguir para a etapa atual.
--
-- RLS: a equipe com acesso à obra lê; grava quem pode editar a fase de
-- projeto (mesmos papéis de 'projectPhase:edit' em src/config/permissions.ts).
-- Nenhuma policy para cliente. Sem carga de dados. Idempotente.
-- =====================================================================

-- 1) Etapas ------------------------------------------------------------
-- A ORDEM dos valores é a ordem do fluxo: o gatilho e a RPC comparam etapas
-- com < e >=. Etapa nova só pode entrar com ADD VALUE ... BEFORE/AFTER.
DO $$ BEGIN
  CREATE TYPE public.project_phase_step AS ENUM (
    'projeto_3d',
    'projeto_executivo',
    'medicao_fina',
    'emissao_art',
    'solicitacao_aprovacao',
    'aprovacao_condominio'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Tabela ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_phase_steps (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  step                public.project_phase_step NOT NULL,
  responsible_user_id uuid REFERENCES public.users_profile(id) ON DELETE SET NULL,
  due_date            date,                 -- prazo combinado para a etapa
  done_at             date,                 -- dia em que aconteceu; NULL = não concluída
  notes               text,
  updated_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_phase_steps_project_step_key UNIQUE (project_id, step)
);

CREATE INDEX IF NOT EXISTS project_phase_steps_project_idx
  ON public.project_phase_steps (project_id);
CREATE INDEX IF NOT EXISTS project_phase_steps_responsible_idx
  ON public.project_phase_steps (responsible_user_id) WHERE responsible_user_id IS NOT NULL;

COMMENT ON TABLE public.project_phase_steps IS
  'Fase de projeto: responsável, prazo e conclusão de cada uma das seis etapas antes da obra. Linhas criadas sob demanda. Somente staff.';
COMMENT ON COLUMN public.project_phase_steps.due_date IS 'Prazo combinado para concluir a etapa.';
COMMENT ON COLUMN public.project_phase_steps.done_at IS 'Dia em que a etapa foi concluída (nunca no futuro). NULL = em aberto.';
COMMENT ON COLUMN public.project_phase_steps.updated_by IS 'Quem gravou por último (preenchido pelo banco).';

-- 3) Quem pode gravar ---------------------------------------------------
-- Mesmos papéis de 'projectPhase:edit' / 'journey:edit_stages'
-- (src/config/permissions.ts): financeiro e suprimentos são staff, mas não
-- conduzem a fase de projeto. SECURITY DEFINER porque as policies rodam como o
-- usuário, que não lê user_roles de outras pessoas.
CREATE OR REPLACE FUNCTION public.can_edit_project_phase(_user_id uuid)
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

REVOKE ALL ON FUNCTION public.can_edit_project_phase(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_project_phase(uuid) TO authenticated, service_role;

-- 4) Antes de gravar: normaliza, carimba e recusa conclusão no futuro ---
CREATE OR REPLACE FUNCTION public.project_phase_steps_before_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  -- current_date no Supabase é UTC (já é "amanhã" depois das 21h em SP).
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  -- Apagar o perfil do responsável ou o usuário que gravou zera a coluna
  -- (ON DELETE SET NULL). Isso não é uma edição: a linha fica como está, sem
  -- novo carimbo — e sem recolocar em updated_by um usuário que está sendo
  -- apagado, o que faria a exclusão falhar. Reconhecemos o caso por ser um
  -- UPDATE vindo de dentro de outro gatilho (o da FK) que só esvazia essas
  -- colunas; quem tira o responsável pela tela chega com profundidade 1.
  IF TG_OP = 'UPDATE'
     AND pg_trigger_depth() > 1
     AND (to_jsonb(NEW) - 'updated_by' - 'responsible_user_id')
       = (to_jsonb(OLD) - 'updated_by' - 'responsible_user_id')
     AND (NEW.updated_by IS NULL OR NEW.updated_by IS NOT DISTINCT FROM OLD.updated_by)
     AND (NEW.responsible_user_id IS NULL
          OR NEW.responsible_user_id IS NOT DISTINCT FROM OLD.responsible_user_id)
     AND (NEW.updated_by IS DISTINCT FROM OLD.updated_by
          OR NEW.responsible_user_id IS DISTINCT FROM OLD.responsible_user_id) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND (NEW.project_id IS DISTINCT FROM OLD.project_id
                           OR NEW.step IS DISTINCT FROM OLD.step) THEN
    RAISE EXCEPTION 'Não é possível mover uma etapa para outra obra ou trocar a etapa de uma linha' USING ERRCODE = '23514';
  END IF;

  IF NEW.done_at IS NOT NULL AND NEW.done_at > v_today THEN
    RAISE EXCEPTION 'A data de conclusão não pode ser no futuro' USING ERRCODE = '23514';
  END IF;

  NEW.notes      := nullif(btrim(NEW.notes), '');
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    NEW.updated_by := auth.uid();
  ELSE
    NEW.created_at := OLD.created_at;
    -- Sem usuário na sessão (rotina do banco, service role): mantém quem
    -- gravou por último em vez de apagar a autoria.
    NEW.updated_by := coalesce(auth.uid(), OLD.updated_by);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS project_phase_steps_before_write_trg ON public.project_phase_steps;
CREATE TRIGGER project_phase_steps_before_write_trg
  BEFORE INSERT OR UPDATE ON public.project_phase_steps
  FOR EACH ROW EXECUTE FUNCTION public.project_phase_steps_before_write();

-- 5) Etapa do Painel: início da etapa no dia de São Paulo ----------------
-- O gatilho antigo gravava CURRENT_DATE (UTC): entre 21h e meia-noite em São
-- Paulo a etapa "começava amanhã". Mesmo comportamento, com o dia certo — o
-- gatilho abaixo muda a etapa do Painel e depende disso.
CREATE OR REPLACE FUNCTION public.set_painel_inicio_etapa_on_etapa_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só dispara se a etapa mudou E o caller não forneceu inicio_etapa
  -- explícito na mesma UPDATE (permite override manual).
  IF NEW.painel_etapa IS DISTINCT FROM OLD.painel_etapa
     AND NEW.painel_inicio_etapa IS NOT DISTINCT FROM OLD.painel_inicio_etapa
  THEN
    NEW.painel_inicio_etapa := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  END IF;
  RETURN NEW;
END;
$$;

-- 6) Depois de gravar: mantém projects coerente -------------------------
-- Só age enquanto a obra está em fase de projeto, e só quando uma CONCLUSÃO
-- muda (marcar, reabrir, corrigir a data, apagar etapa concluída). Editar
-- prazo, responsável ou observação não mexe em projects — a não ser na
-- primeira vez em que algo é registrado numa obra ainda sem etapa no Painel,
-- que passa a mostrar a etapa atual do fluxo.
CREATE OR REPLACE FUNCTION public.project_phase_steps_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today      date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_pid        uuid;
  v_step       public.project_phase_step;
  v_old_done   date;
  v_new_done   date;
  v_changed    boolean;
  v_p          record;
  v_current    public.project_phase_step;
  v_etapa      public.painel_etapa_enum;
  v_inicio     date;
  v_3d         date;
  v_exec       date;
  v_obra       date;
  v_official   date;
  v_cstart     date;
  v_ctrigger   public.contract_start_trigger;
  v_rule       date;
  v_free_terms boolean;
  v_passed     boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_pid := OLD.project_id; v_step := OLD.step; v_old_done := OLD.done_at; v_new_done := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_pid := NEW.project_id; v_step := NEW.step; v_old_done := OLD.done_at; v_new_done := NEW.done_at;
  ELSE
    v_pid := NEW.project_id; v_step := NEW.step; v_old_done := NULL; v_new_done := NEW.done_at;
  END IF;

  v_changed := v_new_done IS DISTINCT FROM v_old_done;
  IF NOT v_changed AND TG_OP <> 'INSERT' THEN
    RETURN NULL;
  END IF;

  -- Trava a obra: duas pessoas concluindo etapas ao mesmo tempo calculam a
  -- etapa atual uma depois da outra. Obra apagada (cascade) = nada a fazer.
  SELECT p.is_project_phase, p.painel_etapa, p.painel_inicio_etapa,
         p.date_approval_3d, p.date_approval_exec, p.date_approval_obra,
         p.date_official_start, p.contract_start_date, p.contract_start_trigger,
         p.contract_terms_confirmed_at
    INTO v_p
    FROM public.projects p
   WHERE p.id = v_pid
   FOR UPDATE;

  IF NOT FOUND OR NOT coalesce(v_p.is_project_phase, false) THEN
    RETURN NULL;
  END IF;

  v_etapa    := v_p.painel_etapa;
  v_inicio   := v_p.painel_inicio_etapa;
  v_3d       := v_p.date_approval_3d;
  v_exec     := v_p.date_approval_exec;
  v_obra     := v_p.date_approval_obra;
  v_official := v_p.date_official_start;
  v_cstart   := v_p.contract_start_date;
  v_ctrigger := v_p.contract_start_trigger;

  IF v_changed THEN
    -- b) Datas espelhadas: gravadas ao concluir, limpas ao reabrir/apagar.
    IF v_step = 'projeto_3d' THEN
      v_3d := v_new_done;
    ELSIF v_step = 'projeto_executivo' THEN
      v_exec := v_new_done;
    ELSIF v_step = 'aprovacao_condominio' THEN
      v_obra := v_new_done;
      -- Termos conferidos com o contrato, ou outro gatilho de início
      -- (assinatura, entrega das chaves…), nunca são sobrescritos.
      v_free_terms := v_p.contract_terms_confirmed_at IS NULL
                      AND (v_ctrigger IS NULL OR v_ctrigger = 'liberacao_condominio');
      IF v_new_done IS NOT NULL THEN
        -- c) Início oficial = 5 dias úteis depois da aprovação do condomínio
        --    (fins de semana, feriados de SP e dias não úteis da obra fora).
        v_rule     := public.add_business_days(v_pid, v_new_done, 5);
        v_official := v_rule;
        IF v_free_terms THEN
          v_cstart   := v_rule;
          v_ctrigger := 'liberacao_condominio';
        END IF;
      ELSE
        -- Aprovação reaberta: limpa só o que esta regra tinha gravado. Data
        -- que alguém ajustou à mão depois continua lá; o gatilho de início
        -- do contrato fica como está.
        v_rule := public.add_business_days(v_pid, v_old_done, 5);
        IF v_official = v_rule THEN
          v_official := NULL;
        END IF;
        IF v_free_terms AND v_cstart = v_rule THEN
          v_cstart := NULL;
        END IF;
      END IF;
    END IF;

    -- Concluir o Projeto executivo passa pelo card "Executivo Aprovado": é
    -- essa transição que dispara o aviso ao financeiro
    -- (trg_notify_executivo_aprovado). Se o card já está lá, o aviso já saiu.
    IF v_step = 'projeto_executivo' AND v_old_done IS NULL AND v_new_done IS NOT NULL
       AND v_p.painel_etapa IS DISTINCT FROM 'Executivo Aprovado'::public.painel_etapa_enum THEN
      UPDATE public.projects
         SET painel_etapa = 'Executivo Aprovado',
             painel_inicio_etapa = v_today
       WHERE id = v_pid;
      v_passed := true;
    END IF;
  END IF;

  -- a) Etapa atual = primeira, na ordem do fluxo, sem conclusão registrada.
  IF v_changed OR v_p.painel_etapa IS NULL THEN
    SELECT s.step INTO v_current
      FROM unnest(enum_range(NULL::public.project_phase_step)) AS s(step)
     WHERE NOT EXISTS (
             SELECT 1 FROM public.project_phase_steps r
              WHERE r.project_id = v_pid AND r.step = s.step AND r.done_at IS NOT NULL
           )
     ORDER BY s.step
     LIMIT 1;

    IF v_current IS NULL THEN
      -- As seis concluídas: a obra vai para o Planejamento. Se o card já foi
      -- levado adiante à mão (Mobilização…), não volta.
      IF v_etapa IS NULL OR v_etapa < 'Planejamento'::public.painel_etapa_enum THEN
        v_etapa := 'Planejamento';
      END IF;
    ELSE
      v_etapa := CASE v_current
        WHEN 'projeto_3d'            THEN 'Projeto 3D'
        WHEN 'projeto_executivo'     THEN 'Projeto Executivo'
        WHEN 'medicao_fina'          THEN 'Medição'
        WHEN 'emissao_art'           THEN 'Emissão RRT'
        WHEN 'solicitacao_aprovacao' THEN 'Condomínio'
        WHEN 'aprovacao_condominio'  THEN 'Condomínio'
      END::public.painel_etapa_enum;
    END IF;
  END IF;

  IF v_etapa IS DISTINCT FROM v_p.painel_etapa THEN
    v_inicio := v_today;
  END IF;

  -- Uma gravação só, e só se algo mudou de fato (não mexe em updated_at nem
  -- dispara os gatilhos do Painel à toa).
  IF v_passed
     OR v_etapa    IS DISTINCT FROM v_p.painel_etapa
     OR v_3d       IS DISTINCT FROM v_p.date_approval_3d
     OR v_exec     IS DISTINCT FROM v_p.date_approval_exec
     OR v_obra     IS DISTINCT FROM v_p.date_approval_obra
     OR v_official IS DISTINCT FROM v_p.date_official_start
     OR v_cstart   IS DISTINCT FROM v_p.contract_start_date
     OR v_ctrigger IS DISTINCT FROM v_p.contract_start_trigger THEN
    UPDATE public.projects
       SET painel_etapa           = v_etapa,
           painel_inicio_etapa    = v_inicio,
           date_approval_3d       = v_3d,
           date_approval_exec     = v_exec,
           date_approval_obra     = v_obra,
           date_official_start    = v_official,
           contract_start_date    = v_cstart,
           contract_start_trigger = v_ctrigger
     WHERE id = v_pid;
  END IF;

  RETURN NULL; -- AFTER: o retorno é ignorado.
END $$;

REVOKE ALL ON FUNCTION public.project_phase_steps_sync() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS project_phase_steps_sync ON public.project_phase_steps;
CREATE TRIGGER project_phase_steps_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.project_phase_steps
  FOR EACH ROW EXECUTE FUNCTION public.project_phase_steps_sync();

-- 7) RLS ----------------------------------------------------------------
ALTER TABLE public.project_phase_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_phase_steps_staff_select ON public.project_phase_steps;
CREATE POLICY project_phase_steps_staff_select ON public.project_phase_steps
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), project_id));

DROP POLICY IF EXISTS project_phase_steps_editors_all ON public.project_phase_steps;
CREATE POLICY project_phase_steps_editors_all ON public.project_phase_steps
  FOR ALL TO authenticated
  USING (public.can_edit_project_phase(auth.uid()) AND public.has_project_access(auth.uid(), project_id))
  WITH CHECK (public.can_edit_project_phase(auth.uid()) AND public.has_project_access(auth.uid(), project_id));

REVOKE ALL ON public.project_phase_steps FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_phase_steps TO authenticated;

-- 8) "Esta obra está na etapa X" ----------------------------------------
-- Conclui as etapas anteriores (hoje, se ainda não tinham data) e reabre X e
-- as seguintes. É o jeito de posicionar uma obra que nunca foi registrada e
-- de voltar uma etapa quando algo foi marcado por engano.
CREATE OR REPLACE FUNCTION public.move_project_to_phase_step(
  p_project_id uuid,
  p_step public.project_phase_step
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_phase boolean;
  v_3d    date;
  v_exec  date;
  v_etapa public.painel_etapa_enum;
BEGIN
  IF v_uid IS NULL OR NOT public.can_edit_project_phase(v_uid) THEN
    RAISE EXCEPTION 'Sem permissão para alterar a fase de projeto'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_project_access(v_uid, p_project_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta obra'
      USING ERRCODE = '42501';
  END IF;

  IF p_step IS NULL THEN
    RAISE EXCEPTION 'Informe em que etapa a obra está' USING ERRCODE = '23514';
  END IF;

  SELECT p.is_project_phase, p.date_approval_3d, p.date_approval_exec
    INTO v_phase, v_3d, v_exec
    FROM public.projects p
   WHERE p.id = p_project_id AND p.deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Obra não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF NOT coalesce(v_phase, false) THEN
    RAISE EXCEPTION 'Esta obra já saiu da fase de projeto: as etapas de projeto não podem mais ser alteradas'
      USING ERRCODE = '23514';
  END IF;

  -- Anteriores: concluídas. Quem já tinha data de conclusão fica com ela; e
  -- quando o cadastro da obra já guardava a data de aprovação do 3D ou do
  -- executivo, é ela que vale (posicionar a obra não pode trocar uma data
  -- real por "hoje" — o gatilho espelha done_at de volta nessas colunas).
  INSERT INTO public.project_phase_steps (project_id, step, done_at)
  SELECT p_project_id, s.step,
         LEAST(v_today, COALESCE(
           CASE s.step
             WHEN 'projeto_3d'        THEN v_3d
             WHEN 'projeto_executivo' THEN v_exec
           END,
           v_today))
    FROM unnest(enum_range(NULL::public.project_phase_step)) AS s(step)
   WHERE s.step < p_step
   ORDER BY s.step
  ON CONFLICT (project_id, step) DO UPDATE
     SET done_at = EXCLUDED.done_at
   WHERE public.project_phase_steps.done_at IS NULL;

  -- X e as seguintes: em aberto (prazo, responsável e observação ficam).
  UPDATE public.project_phase_steps
     SET done_at = NULL
   WHERE project_id = p_project_id
     AND step >= p_step
     AND done_at IS NOT NULL;

  -- A etapa X passa a existir, em aberto. Sem isto, posicionar em "Projeto 3D"
  -- uma obra que nunca foi registrada não gravava nada (não há etapa anterior
  -- para concluir nem seguinte para reabrir) e ela continuava "sem etapa
  -- registrada" no Painel.
  INSERT INTO public.project_phase_steps (project_id, step)
  VALUES (p_project_id, p_step)
  ON CONFLICT (project_id, step) DO NOTHING;

  -- "A obra está na etapa X" vale também para o card do Painel. O gatilho de
  -- sincronização só age quando uma conclusão muda; numa obra que tinha uma
  -- etapa antiga digitada à mão e nenhuma conclusão a mudar, o card ficaria
  -- com o valor antigo.
  v_etapa := CASE p_step
    WHEN 'projeto_3d'            THEN 'Projeto 3D'
    WHEN 'projeto_executivo'     THEN 'Projeto Executivo'
    WHEN 'medicao_fina'          THEN 'Medição'
    WHEN 'emissao_art'           THEN 'Emissão RRT'
    WHEN 'solicitacao_aprovacao' THEN 'Condomínio'
    WHEN 'aprovacao_condominio'  THEN 'Condomínio'
  END::public.painel_etapa_enum;

  UPDATE public.projects
     SET painel_etapa = v_etapa
   WHERE id = p_project_id
     AND painel_etapa IS DISTINCT FROM v_etapa;
END;
$$;

REVOKE ALL ON FUNCTION public.move_project_to_phase_step(uuid, public.project_phase_step) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.move_project_to_phase_step(uuid, public.project_phase_step) TO authenticated;

COMMENT ON FUNCTION public.move_project_to_phase_step(uuid, public.project_phase_step) IS
  'Posiciona a obra numa etapa da fase de projeto: conclui as anteriores e reabre a etapa informada e as seguintes.';

-- 9) Jornada do cliente → etapa interna (só neste sentido) ---------------
-- Concluir "Projeto 3D", "Projeto Executivo" ou "Medição Técnica" na Jornada
-- marca a etapa interna correspondente, se ainda estava em aberto. Nunca o
-- contrário, e nunca para "Liberação da Obra": essa é concluída à força por
-- start_project_execution, que não pode inventar a data de aprovação do
-- condomínio.
-- A Jornada é a tela do cliente: nada aqui pode impedir a mudança de etapa
-- dela — todo o corpo está num bloco EXCEPTION que só registra WARNING. Roda
-- ao lado de trg_notify_stage_changed, sem alterar a linha da Jornada.
CREATE OR REPLACE FUNCTION public.journey_stage_completes_phase_step()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_name  text := btrim(coalesce(NEW.name, ''));
  v_step  public.project_phase_step;
BEGIN
  IF NEW.status::text = 'completed' AND OLD.status IS DISTINCT FROM NEW.status THEN
    BEGIN
      -- Sem distinguir maiúsculas nem depender dos acentos (como o
      -- 'Libera%o da Obra' de start_project_execution).
      v_step := CASE
        WHEN v_name ILIKE 'Projeto 3D'        THEN 'projeto_3d'
        WHEN v_name ILIKE 'Projeto Executivo' THEN 'projeto_executivo'
        WHEN v_name ILIKE 'Medi%o T%cnica'    THEN 'medicao_fina'
      END::public.project_phase_step;

      IF v_step IS NOT NULL AND EXISTS (
           SELECT 1 FROM public.projects p
            WHERE p.id = NEW.project_id AND coalesce(p.is_project_phase, false)
         ) THEN
        INSERT INTO public.project_phase_steps (project_id, step, done_at)
        VALUES (NEW.project_id, v_step, least(coalesce(NEW.confirmed_end, v_today), v_today))
        ON CONFLICT (project_id, step) DO UPDATE
           SET done_at = EXCLUDED.done_at
         WHERE public.project_phase_steps.done_at IS NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'journey_stage_completes_phase_step falhou para a etapa % da obra %: %',
        NEW.id, NEW.project_id, SQLERRM;
    END;
  END IF;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.journey_stage_completes_phase_step() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_journey_stage_completes_phase_step ON public.journey_stages;
CREATE TRIGGER trg_journey_stage_completes_phase_step
  AFTER UPDATE OF status ON public.journey_stages
  FOR EACH ROW EXECUTE FUNCTION public.journey_stage_completes_phase_step();
