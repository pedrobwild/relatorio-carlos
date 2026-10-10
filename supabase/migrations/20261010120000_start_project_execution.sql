-- Iniciar obra: tira a obra da fase de projeto numa única transação.
--
-- POR QUE ISTO EXISTE
-- O cliente só vê o cronograma quando projects.is_project_phase = false; até
-- lá o portal o mantém na Jornada (src/pages/Index.tsx redireciona). Nada no
-- sistema virava essa chave quando a obra começava:
--   * "Concluir Mobilização" CLONAVA a obra (cloneProjectForConstruction):
--     criava uma obra nova, marcava a original como 'completed', perdia o
--     vínculo do cliente e deixava duplicatas (Elements Higienópolis 88/509).
--   * O banner "Encerrar fase de projeto" só aparecia com TODAS as etapas
--     concluídas — inalcançável sem concluir a Mobilização (que clonava).
--   * O switch em Editar Obra existia, mas ninguém o associava a "liberar o
--     cronograma para o cliente".
-- Resultado (10/10/2026): Exalt Ibirapuera 808 parada em "Liberação da Obra"
-- com a obra já começando; cliente cobrando o cronograma que não via.
--
-- O QUE FAZ
-- Na mesma obra (sem clonar):
--   1. exige cronograma cadastrado (project_activities) — sem ele o cliente
--      cairia numa tela vazia;
--   2. conclui as etapas da jornada que ainda não estavam concluídas
--      (Liberação da Obra, Mobilização…), com a data de início como
--      confirmed_end quando não havia data — o cliente é notificado pelo
--      trigger notify_stage_changed já existente;
--   3. vira is_project_phase = false, preenche datas planejadas vazias e
--      reativa obras em 'draft'/'completed' indevido.
-- Idempotente: em obra que já está em execução, só devolve o estado.

CREATE OR REPLACE FUNCTION public.start_project_execution(
  p_project_id uuid,
  p_start_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project public.projects%ROWTYPE;
  v_start date;
  v_activities int;
  v_first_start date;
  v_last_end date;
  v_completed_stages int := 0;
BEGIN
  IF v_uid IS NULL OR NOT public.is_staff(v_uid) THEN
    RAISE EXCEPTION 'Apenas a equipe pode iniciar a obra'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_project_access(v_uid, p_project_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta obra'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_project
    FROM public.projects
   WHERE id = p_project_id AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Obra não encontrada' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*), min(planned_start), max(planned_end)
    INTO v_activities, v_first_start, v_last_end
    FROM public.project_activities
   WHERE project_id = p_project_id;

  IF NOT v_project.is_project_phase THEN
    RETURN jsonb_build_object(
      'project_id', p_project_id,
      'already_in_execution', true,
      'activities', v_activities,
      'completed_stages', 0
    );
  END IF;

  IF v_activities = 0 THEN
    RAISE EXCEPTION 'Cadastre o cronograma antes de iniciar a obra: sem ele o cliente não tem o que acompanhar'
      USING ERRCODE = 'P0001',
            HINT = 'Abra o Cronograma da obra, importe ou monte as atividades e salve.';
  END IF;

  -- Obras criadas por modelo nascem com atividades-placeholder, todas na data
  -- de criação. Isso não é cronograma: o cliente veria uma linha só.
  IF v_activities > 1 AND v_first_start = v_last_end THEN
    RAISE EXCEPTION 'O cronograma desta obra ainda é o modelo (todas as atividades na mesma data). Preencha as datas reais antes de iniciar a obra'
      USING ERRCODE = 'P0001',
            HINT = 'Abra o Cronograma da obra e ajuste as datas das atividades.';
  END IF;

  v_start := COALESCE(p_start_date, v_first_start, current_date);

  WITH done AS (
    UPDATE public.journey_stages
       SET status = 'completed',
           confirmed_end = COALESCE(confirmed_end, v_start)
     WHERE project_id = p_project_id
       AND status <> 'completed'
    RETURNING 1
  )
  SELECT count(*) INTO v_completed_stages FROM done;

  UPDATE public.projects
     SET is_project_phase = false,
         status = CASE WHEN status IN ('draft', 'completed') THEN 'active' ELSE status END,
         planned_start_date = COALESCE(planned_start_date, v_start),
         planned_end_date = COALESCE(planned_end_date, v_last_end),
         date_approval_obra = COALESCE(date_approval_obra, v_start),
         date_mobilization_start = COALESCE(date_mobilization_start, v_start)
   WHERE id = p_project_id;

  RETURN jsonb_build_object(
    'project_id', p_project_id,
    'already_in_execution', false,
    'activities', v_activities,
    'completed_stages', v_completed_stages,
    'start_date', v_start
  );
END;
$$;

REVOKE ALL ON FUNCTION public.start_project_execution(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_project_execution(uuid, date) TO authenticated;

COMMENT ON FUNCTION public.start_project_execution(uuid, date) IS
  'Tira a obra da fase de projeto (sem clonar): exige cronograma, conclui as etapas da jornada e libera o cronograma para o cliente.';
