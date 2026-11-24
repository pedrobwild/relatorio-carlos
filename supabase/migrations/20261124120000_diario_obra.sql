-- =====================================================================
-- DIÁRIO DE OBRA (relatório de campo diário, feito no celular)
--
-- O QUE É
-- O gestor de operação ou o coordenador técnico relata o dia de UMA obra em
-- 5 passos: quem e onde, etapas do dia (com foto), equipe, e — só se houver —
-- pendências, material recebido e mudança de prazo. Tela: /gestao/diario.
--
-- O QUE O ENVIO FAZ (tudo dentro de `diario_obra_enviar`, numa transação)
--   1. Grava o relato (4 tabelas abaixo). O envio é idempotente pelo
--      `client_id` gerado no aparelho: reenviar a fila offline não duplica.
--   2. Etapa "Concluída" vira término real no cronograma interno e, se for
--      etapa de 1º nível ligada ao cliente, também no cronograma do cliente —
--      a mesma regra de "Atualizar etapas" e do Hoje. Só preenche data que
--      está vazia; nunca sobrescreve uma data real já lançada.
--   3. Marco de início real: concluir "Adequação elétrica", ou concluir uma
--      medição de marmoraria ou de vidraçaria, grava
--      `projects.actual_start_date` — só se ainda estiver vazio. Medição de
--      marcenaria não conta.
--   4. Etapa "Impedida" exige uma pendência ligada a ela, com responsável,
--      prazo e "trava a obra?".
--   5. O que é do cliente entra sozinho no relatório semanal da obra
--      (`weekly_reports`) da semana do relato: SÓ o texto e a foto das etapas
--      concluídas ou em andamento. O relatório fica visível ao cliente pelo
--      `available_at` (sexta, 18h — ver 20261124120100).
--
-- O QUE NÃO VAI PARA O CLIENTE
-- Etapa impedida (nem texto nem foto), nomes e tamanho da equipe,
-- pendências, material, divergências e a mudança de prazo. A mudança de
-- prazo fica só registrada: NÃO altera a data de entrega da obra.
--
-- SEGURANÇA
-- Leitura: staff com acesso à obra. Nenhuma policy de escrita: tudo entra
-- pelas RPCs SECURITY DEFINER, que conferem is_staff + has_project_access e
-- revalidam as regras da tela. Nenhuma policy para cliente. Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diario_obra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  report_date date NOT NULL,
  reporter_id uuid NOT NULL,
  reporter_function text NOT NULL CHECK (reporter_function IN ('gestor', 'coordenador')),
  no_progress boolean NOT NULL DEFAULT false,
  team_count integer NOT NULL DEFAULT 0 CHECK (team_count >= 0),
  -- Interno: nunca entra no texto do cliente.
  team_names text,
  third_parties text[] NOT NULL DEFAULT '{}',
  new_delivery_date date,
  deadline_reason text CHECK (deadline_reason IN ('material', 'terceiro', 'cliente', 'condominio', 'outro')),
  client_notified text CHECK (client_notified IN ('sim', 'nao', 'vai')),
  sent_offline boolean NOT NULL DEFAULT false,
  -- Relatório semanal que recebeu este relato (null = nada para o cliente).
  weekly_report_id uuid REFERENCES public.weekly_reports(id) ON DELETE SET NULL,
  week_number integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diario_obra_client_id_unique UNIQUE (client_id)
);

CREATE INDEX IF NOT EXISTS diario_obra_project_date_idx
  ON public.diario_obra (project_id, report_date DESC);

CREATE TABLE IF NOT EXISTS public.diario_obra_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diario_id uuid NOT NULL REFERENCES public.diario_obra(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.internal_schedule_items(id) ON DELETE SET NULL,
  -- Nome da etapa no dia do relato (o cronograma pode mudar depois).
  description text NOT NULL,
  status text NOT NULL CHECK (status IN ('concluida', 'andamento', 'impedida')),
  -- Foto do serviço, no bucket `weekly-reports` (vai para o cliente).
  photo_path text NOT NULL,
  marco text CHECK (marco IN ('eletrica', 'medicao')),
  medicao_tipo text CHECK (medicao_tipo IN ('marmoraria', 'vidracaria', 'marcenaria')),
  medicao_agendada boolean NOT NULL DEFAULT false,
  medicao_data date,
  medicao_fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  -- Texto do cliente: o que foi gerado/ajustado e o que está no relatório.
  texto_cliente text,
  texto_cliente_aplicado text,
  texto_revisado_em timestamptz,
  texto_revisado_por uuid
);

CREATE INDEX IF NOT EXISTS diario_obra_etapas_diario_idx ON public.diario_obra_etapas (diario_id);
CREATE INDEX IF NOT EXISTS diario_obra_etapas_item_idx ON public.diario_obra_etapas (project_id, item_id);

CREATE TABLE IF NOT EXISTS public.diario_obra_pendencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diario_id uuid NOT NULL REFERENCES public.diario_obra(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  -- Etapa impedida que abriu a pendência (null = pendência avulsa).
  etapa_item_id uuid REFERENCES public.internal_schedule_items(id) ON DELETE SET NULL,
  etapa_description text,
  description text NOT NULL CHECK (length(btrim(description)) > 0),
  responsible text NOT NULL CHECK (length(btrim(responsible)) > 0),
  responsible_user_id uuid,
  due_date date NOT NULL,
  blocks_work boolean NOT NULL,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'resolvida')),
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS diario_obra_pendencias_open_idx
  ON public.diario_obra_pendencias (project_id, status, due_date);

CREATE TABLE IF NOT EXISTS public.diario_obra_materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diario_id uuid NOT NULL REFERENCES public.diario_obra(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  item text NOT NULL CHECK (length(btrim(item)) > 0),
  purchase_id uuid REFERENCES public.project_purchases(id) ON DELETE SET NULL,
  arrived text NOT NULL CHECK (arrived IN ('sim', 'nao', 'parcial')),
  checked text NOT NULL CHECK (checked IN ('ok', 'div', 'nc')),
  -- Foto da divergência, no bucket `ops-photos` (interna).
  divergence_photo_path text,
  divergence_description text,
  CONSTRAINT diario_obra_materiais_divergencia CHECK (
    checked <> 'div'
    OR (divergence_photo_path IS NOT NULL AND length(btrim(coalesce(divergence_description, ''))) > 0)
  )
);

CREATE INDEX IF NOT EXISTS diario_obra_materiais_diario_idx ON public.diario_obra_materiais (diario_id);

-- ---------------------------------------------------------------------
-- RLS: staff com acesso à obra lê; escrita só pelas RPCs.
-- ---------------------------------------------------------------------
ALTER TABLE public.diario_obra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diario_obra_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diario_obra_pendencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diario_obra_materiais ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['diario_obra', 'diario_obra_etapas', 'diario_obra_pendencias', 'diario_obra_materiais']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_staff_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
         USING (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), project_id))',
      t || '_staff_select', t
    );
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- Marco pelo nome da etapa (espelhado em src/lib/diarioObra/regras.ts).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.diario_obra_marco(p_description text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN btrim(coalesce(p_description, '')) ~* '^medi[cç][aã]o(\s|$)' THEN 'medicao'
    WHEN coalesce(p_description, '') ~* 'adequa[cç][aãoõ]\w*\s+el[eé]tric' THEN 'eletrica'
    ELSE NULL
  END
$$;

-- ---------------------------------------------------------------------
-- Semana do relatório semanal em que um dia cai. Mesma conta de
-- `generateWeeklyReports` (WeeklyReportsHistory.tsx): a semana 1 começa no
-- início da obra e fecha na sexta; as seguintes vão de segunda a sexta.
-- Sábado e domingo entram na semana seguinte. Espelhada em regras.ts.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.diario_obra_semana(p_inicio date, p_dia date)
RETURNS TABLE (week_number integer, week_start date, week_end date)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_dia date := p_dia;
  v_dow integer;
  v_first_friday date;
  v_second_monday date;
  v_monday date;
BEGIN
  IF p_inicio IS NULL OR p_dia IS NULL THEN
    RETURN;
  END IF;

  v_dow := extract(dow FROM v_dia)::integer; -- 0 = domingo ... 6 = sábado
  IF v_dow = 6 THEN
    v_dia := v_dia + 2;
  ELSIF v_dow = 0 THEN
    v_dia := v_dia + 1;
  END IF;

  v_dow := extract(dow FROM p_inicio)::integer;
  v_first_friday := CASE
    WHEN v_dow = 5 THEN p_inicio
    WHEN v_dow = 6 THEN p_inicio + 6
    WHEN v_dow = 0 THEN p_inicio + 5
    ELSE p_inicio + (5 - v_dow)
  END;

  IF v_dia <= v_first_friday THEN
    RETURN QUERY SELECT 1, p_inicio, v_first_friday;
    RETURN;
  END IF;

  v_second_monday := v_first_friday + 3;
  v_monday := v_dia - ((extract(dow FROM v_dia)::integer + 6) % 7);
  RETURN QUERY SELECT 2 + ((v_monday - v_second_monday) / 7), v_monday, v_monday + 4;
END;
$$;

-- Início usado na numeração das semanas: o mais cedo entre início real e
-- previsto da obra e o início (real ou previsto) da primeira atividade do
-- cronograma do cliente — a mesma conta de useProjectPortal.
CREATE OR REPLACE FUNCTION public.diario_obra_inicio_semanas(p_project_id uuid)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT LEAST(
    p.actual_start_date,
    p.planned_start_date,
    (SELECT min(coalesce(a.actual_start, a.planned_start))
       FROM public.project_activities a
      WHERE a.project_id = p.id)
  )
  FROM public.projects p
  WHERE p.id = p_project_id
$$;

REVOKE ALL ON FUNCTION public.diario_obra_inicio_semanas(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- Leva o que é do cliente para o relatório semanal da semana do relato.
-- Interna: só é chamada pelas RPCs abaixo (que já conferiram o acesso).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.diario_obra_alimentar_semanal(p_diario_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_d public.diario_obra;
  v_p public.projects;
  v_week record;
  v_report public.weekly_reports;
  v_data jsonb;
  v_summary text;
  v_gallery jsonb;
  v_block text;
  v_client text;
  e record;
  v_any boolean := false;
BEGIN
  SELECT * INTO v_d FROM public.diario_obra WHERE id = p_diario_id;
  IF v_d.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Etapa impedida é assunto interno: nem texto nem foto vão para o cliente.
  IF NOT EXISTS (
    SELECT 1 FROM public.diario_obra_etapas WHERE diario_id = p_diario_id AND status <> 'impedida'
  ) THEN
    RETURN NULL; -- nada para o cliente
  END IF;

  -- Gravação automática: não dispara o aviso de "relatório disponível".
  PERFORM set_config('bwild.diario_feed', 'on', true);

  SELECT * INTO v_week
  FROM public.diario_obra_semana(public.diario_obra_inicio_semanas(v_d.project_id), v_d.report_date);
  -- Obra sem datas ou fora das 52 semanas que o portal mostra: fica só interno.
  IF v_week.week_number IS NULL OR v_week.week_number < 1 OR v_week.week_number > 52 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_p FROM public.projects WHERE id = v_d.project_id;

  SELECT * INTO v_report
  FROM public.weekly_reports
  WHERE project_id = v_d.project_id AND week_number = v_week.week_number
  FOR UPDATE;

  IF v_report.id IS NULL THEN
    SELECT pc.customer_name INTO v_client
    FROM public.project_customers pc
    WHERE pc.project_id = v_d.project_id
    ORDER BY pc.customer_name
    LIMIT 1;

    -- Mesmo formato de createEmptyReportTemplate (src/data/emptyReportTemplate.ts).
    v_data := jsonb_build_object(
      'projectId', v_d.project_id,
      'projectName', coalesce(v_p.name, ''),
      'unitName', coalesce(v_p.unit_name, ''),
      'clientName', coalesce(v_client, ''),
      'weekNumber', v_week.week_number,
      'periodStart', to_char(v_week.week_start, 'YYYY-MM-DD'),
      'periodEnd', to_char(v_week.week_end, 'YYYY-MM-DD'),
      'issuedAt', '',
      'preparedBy', '',
      'kpis', jsonb_build_object('physicalPlanned', 0, 'physicalActual', 0, 'scheduleVarianceDays', 0),
      'nextMilestones', '[]'::jsonb,
      'executiveSummary', '',
      'activities', '[]'::jsonb,
      'deliverablesCompleted', '[]'::jsonb,
      'lookaheadTasks', '[]'::jsonb,
      'risksAndIssues', '[]'::jsonb,
      'qualityItems', '[]'::jsonb,
      'clientDecisions', '[]'::jsonb,
      'incidents', '[]'::jsonb,
      'gallery', '[]'::jsonb,
      'roomsProgress', '[]'::jsonb
    );
    INSERT INTO public.weekly_reports (project_id, week_number, week_start, week_end, data)
    VALUES (v_d.project_id, v_week.week_number, v_week.week_start, v_week.week_end, v_data)
    RETURNING * INTO v_report;
  END IF;

  v_data := v_report.data;
  v_summary := coalesce(v_data->>'executiveSummary', '');
  v_gallery := CASE WHEN jsonb_typeof(v_data->'gallery') = 'array' THEN v_data->'gallery' ELSE '[]'::jsonb END;

  FOR e IN
    SELECT * FROM public.diario_obra_etapas
    WHERE diario_id = p_diario_id AND status <> 'impedida'
    ORDER BY description, id
  LOOP
    v_block := btrim(coalesce(e.texto_cliente, ''));

    -- Texto: troca o bloco que já está no relatório ou acrescenta no fim.
    IF v_block <> '' AND v_block IS DISTINCT FROM e.texto_cliente_aplicado THEN
      IF coalesce(e.texto_cliente_aplicado, '') <> '' AND position(e.texto_cliente_aplicado IN v_summary) > 0 THEN
        v_summary := replace(v_summary, e.texto_cliente_aplicado, v_block);
      ELSIF position(v_block IN v_summary) = 0 THEN
        v_summary := CASE WHEN btrim(v_summary) = '' THEN v_block ELSE rtrim(v_summary) || E'\n\n' || v_block END;
      END IF;
      UPDATE public.diario_obra_etapas SET texto_cliente_aplicado = v_block WHERE id = e.id;
      v_any := true;
    END IF;

    -- Foto: uma vez só (id derivado da linha da etapa).
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_gallery) g WHERE g->>'id' = 'diario-' || e.id::text
    ) THEN
      v_gallery := v_gallery || jsonb_build_array(jsonb_build_object(
        'id', 'diario-' || e.id::text,
        'url', '',
        'path', e.photo_path,
        'caption', e.description || ' · ' || CASE e.status
          WHEN 'concluida' THEN 'concluída'
          ELSE 'em andamento'
        END,
        'area', '',
        'date', to_char(v_d.report_date, 'YYYY-MM-DD'),
        'category', 'Diário de obra'
      ));
      v_any := true;
    END IF;
  END LOOP;

  IF v_any THEN
    UPDATE public.weekly_reports
    SET data = jsonb_set(jsonb_set(v_data, '{executiveSummary}', to_jsonb(v_summary)), '{gallery}', v_gallery)
    WHERE id = v_report.id;
  END IF;

  UPDATE public.diario_obra
  SET weekly_report_id = v_report.id, week_number = v_week.week_number
  WHERE id = p_diario_id;

  PERFORM set_config('bwild.diario_feed', '', true);
  RETURN v_report.id;
END;
$$;

REVOKE ALL ON FUNCTION public.diario_obra_alimentar_semanal(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- Envio do diário. Revalida as regras da tela e aplica os efeitos.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.diario_obra_enviar(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_client_id uuid;
  v_project_id uuid;
  v_date date;
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_existing public.diario_obra;
  v_id uuid;
  v_no_progress boolean := coalesce((p_payload->>'no_progress')::boolean, false);
  v_team_count integer := coalesce((p_payload->>'team_count')::integer, 0);
  v_team_names text := nullif(btrim(coalesce(p_payload->>'team_names', '')), '');
  v_etapas jsonb := coalesce(p_payload->'etapas', '[]'::jsonb);
  v_pends jsonb := coalesce(p_payload->'pendencias', '[]'::jsonb);
  v_mats jsonb := coalesce(p_payload->'materiais', '[]'::jsonb);
  v_prazo jsonb := p_payload->'prazo';
  v_has_prazo boolean;
  v_n_etapas integer;
  e jsonb;
  v_item public.internal_schedule_items;
  v_item_id uuid;
  v_status text;
  v_marco text;
  v_tipo text;
  v_done integer := 0;
  v_start_set boolean := false;
  v_weekly uuid;
BEGIN
  IF v_uid IS NULL OR NOT public.is_staff(v_uid) THEN
    RAISE EXCEPTION 'Sem permissão para enviar o diário de obra' USING ERRCODE = '42501';
  END IF;

  v_client_id := (p_payload->>'client_id')::uuid;
  v_project_id := (p_payload->>'project_id')::uuid;
  v_date := (p_payload->>'report_date')::date;
  IF v_client_id IS NULL OR v_project_id IS NULL OR v_date IS NULL THEN
    RAISE EXCEPTION 'Diário incompleto: falta obra ou data' USING ERRCODE = '22023';
  END IF;

  IF NOT public.has_project_access(v_uid, v_project_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta obra' USING ERRCODE = '42501';
  END IF;

  -- Reenvio da fila offline: devolve o que já foi gravado.
  SELECT * INTO v_existing FROM public.diario_obra WHERE client_id = v_client_id;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.reporter_id <> v_uid THEN
      RAISE EXCEPTION 'Este relato pertence a outra pessoa' USING ERRCODE = '42501';
    END IF;
    RETURN jsonb_build_object(
      'id', v_existing.id,
      'weekly_report_id', v_existing.weekly_report_id,
      'week_number', v_existing.week_number,
      'duplicate', true
    );
  END IF;

  IF v_date > v_today THEN
    RAISE EXCEPTION 'A data do relato não pode ser futura' USING ERRCODE = '22023';
  END IF;
  IF coalesce(p_payload->>'reporter_function', '') NOT IN ('gestor', 'coordenador') THEN
    RAISE EXCEPTION 'Informe a função de quem está relatando' USING ERRCODE = '22023';
  END IF;

  v_n_etapas := jsonb_array_length(v_etapas);
  IF v_n_etapas = 0 AND NOT v_no_progress THEN
    RAISE EXCEPTION 'Marque ao menos uma etapa, ou "Nenhuma etapa avançou hoje"' USING ERRCODE = '22023';
  END IF;
  IF v_n_etapas > 0 AND v_team_count < 1 THEN
    RAISE EXCEPTION 'Informe quantas pessoas estiveram na obra' USING ERRCODE = '22023';
  END IF;
  IF (v_n_etapas > 0 OR v_team_count > 0) AND v_team_names IS NULL THEN
    RAISE EXCEPTION 'Informe o nome de quem esteve na obra' USING ERRCODE = '22023';
  END IF;

  v_has_prazo := v_prazo IS NOT NULL AND jsonb_typeof(v_prazo) = 'object';
  IF v_has_prazo AND (
    nullif(v_prazo->>'data', '') IS NULL
    OR coalesce(v_prazo->>'motivo', '') NOT IN ('material', 'terceiro', 'cliente', 'condominio', 'outro')
    OR coalesce(v_prazo->>'avisado', '') NOT IN ('sim', 'nao', 'vai')
  ) THEN
    RAISE EXCEPTION 'Mudança de prazo incompleta: nova data, motivo e aviso ao cliente' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.diario_obra (
    client_id, project_id, report_date, reporter_id, reporter_function, no_progress,
    team_count, team_names, third_parties, new_delivery_date, deadline_reason,
    client_notified, sent_offline
  ) VALUES (
    v_client_id, v_project_id, v_date, v_uid, p_payload->>'reporter_function',
    v_no_progress AND v_n_etapas = 0,
    v_team_count, v_team_names,
    coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'third_parties', '[]'::jsonb))), '{}'),
    CASE WHEN v_has_prazo THEN (v_prazo->>'data')::date END,
    CASE WHEN v_has_prazo THEN v_prazo->>'motivo' END,
    CASE WHEN v_has_prazo THEN v_prazo->>'avisado' END,
    coalesce((p_payload->>'sent_offline')::boolean, false)
  )
  RETURNING id INTO v_id;

  -- Etapas do dia
  FOR e IN SELECT * FROM jsonb_array_elements(v_etapas)
  LOOP
    v_item_id := (e->>'item_id')::uuid;
    v_status := e->>'status';
    SELECT * INTO v_item
    FROM public.internal_schedule_items
    WHERE id = v_item_id AND project_id = v_project_id
    FOR UPDATE;
    IF v_item.id IS NULL THEN
      RAISE EXCEPTION 'Etapa fora do cronograma desta obra' USING ERRCODE = '22023';
    END IF;
    IF coalesce(v_status, '') NOT IN ('concluida', 'andamento', 'impedida') THEN
      RAISE EXCEPTION 'Marque como ficou a etapa: %', v_item.description USING ERRCODE = '22023';
    END IF;
    IF nullif(btrim(coalesce(e->>'photo_path', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Foto obrigatória na etapa: %', v_item.description USING ERRCODE = '22023';
    END IF;
    IF split_part(e->>'photo_path', '/', 1) <> v_project_id::text THEN
      RAISE EXCEPTION 'Foto de outra obra' USING ERRCODE = '22023';
    END IF;

    v_marco := public.diario_obra_marco(v_item.description);
    v_tipo := nullif(e->>'medicao_tipo', '');
    IF v_marco = 'medicao' THEN
      IF coalesce(v_tipo, '') NOT IN ('marmoraria', 'vidracaria', 'marcenaria') THEN
        RAISE EXCEPTION 'Escolha o tipo de medição' USING ERRCODE = '22023';
      END IF;
      IF coalesce((e->>'medicao_agendada')::boolean, false)
         AND (nullif(e->>'medicao_data', '') IS NULL OR nullif(e->>'medicao_fornecedor_id', '') IS NULL) THEN
        RAISE EXCEPTION 'Medição agendada: informe a data e o fornecedor' USING ERRCODE = '22023';
      END IF;
    ELSE
      v_tipo := NULL;
    END IF;

    IF v_status = 'impedida' AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_pends) p WHERE (p->>'etapa_item_id') = v_item_id::text
    ) THEN
      RAISE EXCEPTION 'Etapa impedida precisa de pendência com responsável e prazo: %', v_item.description
        USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.diario_obra_etapas (
      diario_id, project_id, item_id, description, status, photo_path, marco,
      medicao_tipo, medicao_agendada, medicao_data, medicao_fornecedor_id, texto_cliente
    ) VALUES (
      v_id, v_project_id, v_item.id, v_item.description, v_status, e->>'photo_path', v_marco,
      v_tipo,
      v_marco = 'medicao' AND v_status <> 'concluida' AND coalesce((e->>'medicao_agendada')::boolean, false),
      CASE WHEN v_marco = 'medicao' AND v_status <> 'concluida' AND coalesce((e->>'medicao_agendada')::boolean, false)
           THEN (e->>'medicao_data')::date END,
      CASE WHEN v_marco = 'medicao' AND v_status <> 'concluida' AND coalesce((e->>'medicao_agendada')::boolean, false)
           THEN (e->>'medicao_fornecedor_id')::uuid END,
      CASE WHEN v_status <> 'impedida'
           THEN nullif(left(btrim(coalesce(e->>'texto_cliente', '')), 600), '') END
    );

    IF v_status = 'concluida' THEN
      v_done := v_done + 1;

      -- Término real: só preenche o que está vazio.
      IF v_item.actual_end IS NULL THEN
        UPDATE public.internal_schedule_items
        SET actual_end = v_date,
            actual_start = LEAST(coalesce(actual_start, v_date), v_date)
        WHERE id = v_item.id;

        -- Espelho no cronograma do cliente: etapa de 1º nível ligada a ele.
        IF v_item.parent_id IS NULL AND v_item.client_activity_id IS NOT NULL THEN
          UPDATE public.project_activities
          SET actual_end = v_date,
              actual_start = LEAST(coalesce(actual_start, v_date), v_date)
          WHERE id = v_item.client_activity_id
            AND project_id = v_project_id
            AND actual_end IS NULL;
        END IF;
      END IF;

      -- Marco de início real da obra (só se ainda não houver).
      IF v_marco = 'eletrica' OR (v_marco = 'medicao' AND v_tipo IN ('marmoraria', 'vidracaria')) THEN
        UPDATE public.projects
        SET actual_start_date = v_date
        WHERE id = v_project_id AND actual_start_date IS NULL;
        IF FOUND THEN
          v_start_set := true;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Pendências
  FOR e IN SELECT * FROM jsonb_array_elements(v_pends)
  LOOP
    IF nullif(btrim(coalesce(e->>'descricao', '')), '') IS NULL
       OR nullif(btrim(coalesce(e->>'responsavel', '')), '') IS NULL
       OR nullif(e->>'prazo', '') IS NULL
       OR (e->>'trava_obra') IS NULL THEN
      RAISE EXCEPTION 'Pendência incompleta: descrição, responsável, prazo e se trava a obra' USING ERRCODE = '22023';
    END IF;
    v_item_id := nullif(e->>'etapa_item_id', '')::uuid;
    v_item := NULL;
    IF v_item_id IS NOT NULL THEN
      SELECT * INTO v_item
      FROM public.internal_schedule_items
      WHERE id = v_item_id AND project_id = v_project_id;
    END IF;
    INSERT INTO public.diario_obra_pendencias (
      diario_id, project_id, etapa_item_id, etapa_description, description,
      responsible, responsible_user_id, due_date, blocks_work
    ) VALUES (
      v_id, v_project_id, v_item.id, v_item.description, left(btrim(e->>'descricao'), 80),
      btrim(e->>'responsavel'), nullif(e->>'responsavel_user_id', '')::uuid,
      (e->>'prazo')::date, (e->>'trava_obra')::boolean
    );
  END LOOP;

  -- Material recebido
  FOR e IN SELECT * FROM jsonb_array_elements(v_mats)
  LOOP
    IF nullif(btrim(coalesce(e->>'item', '')), '') IS NULL
       OR coalesce(e->>'chegou', '') NOT IN ('sim', 'nao', 'parcial') THEN
      RAISE EXCEPTION 'Material incompleto: qual item e se chegou' USING ERRCODE = '22023';
    END IF;
    IF (e->>'chegou') <> 'nao' AND coalesce(e->>'confere', '') NOT IN ('ok', 'div', 'nc') THEN
      RAISE EXCEPTION 'Material: marque se confere, diverge ou não foi conferido' USING ERRCODE = '22023';
    END IF;
    IF (e->>'chegou') <> 'nao' AND (e->>'confere') = 'div' AND (
      nullif(btrim(coalesce(e->>'divergencia_foto_path', '')), '') IS NULL
      OR nullif(btrim(coalesce(e->>'divergencia_descricao', '')), '') IS NULL
    ) THEN
      RAISE EXCEPTION 'Divergência de material: foto e descrição são obrigatórias' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.diario_obra_materiais (
      diario_id, project_id, item, purchase_id, arrived, checked,
      divergence_photo_path, divergence_description
    ) VALUES (
      v_id, v_project_id, btrim(e->>'item'),
      (SELECT pp.id FROM public.project_purchases pp
        WHERE pp.id = nullif(e->>'purchase_id', '')::uuid AND pp.project_id = v_project_id),
      e->>'chegou',
      CASE WHEN (e->>'chegou') = 'nao' THEN 'nc' ELSE e->>'confere' END,
      CASE WHEN (e->>'chegou') <> 'nao' AND (e->>'confere') = 'div' THEN e->>'divergencia_foto_path' END,
      CASE WHEN (e->>'chegou') <> 'nao' AND (e->>'confere') = 'div'
           THEN left(btrim(e->>'divergencia_descricao'), 80) END
    );
  END LOOP;

  v_weekly := public.diario_obra_alimentar_semanal(v_id);

  RETURN jsonb_build_object(
    'id', v_id,
    'weekly_report_id', v_weekly,
    'week_number', (SELECT d.week_number FROM public.diario_obra d WHERE d.id = v_id),
    'etapas_concluidas', v_done,
    'inicio_real_definido', v_start_set,
    'duplicate', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.diario_obra_enviar(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.diario_obra_enviar(jsonb) TO authenticated;

-- ---------------------------------------------------------------------
-- Ajuste do texto do cliente de uma etapa, antes de o relatório semanal
-- ficar visível. Depois disso o texto só muda pelo relatório semanal.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.diario_obra_salvar_texto_cliente(p_etapa_id uuid, p_texto text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_e public.diario_obra_etapas;
  v_d public.diario_obra;
  v_available timestamptz;
  v_texto text := left(btrim(coalesce(p_texto, '')), 600);
BEGIN
  IF v_uid IS NULL OR NOT public.is_staff(v_uid) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_e FROM public.diario_obra_etapas WHERE id = p_etapa_id FOR UPDATE;
  IF v_e.id IS NULL OR NOT public.has_project_access(v_uid, v_e.project_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta obra' USING ERRCODE = '42501';
  END IF;
  IF v_e.status = 'impedida' THEN
    RAISE EXCEPTION 'Etapa impedida fica só no relatório interno' USING ERRCODE = '22023';
  END IF;
  IF v_texto = '' THEN
    RAISE EXCEPTION 'Escreva o texto do relatório do cliente' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_d FROM public.diario_obra WHERE id = v_e.diario_id;
  SELECT w.available_at INTO v_available FROM public.weekly_reports w WHERE w.id = v_d.weekly_report_id;
  IF v_available IS NOT NULL AND v_available <= now() THEN
    RAISE EXCEPTION 'Este relatório já está visível para o cliente. Ajuste pelo relatório semanal.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.diario_obra_etapas
  SET texto_cliente = v_texto, texto_revisado_em = now(), texto_revisado_por = v_uid
  WHERE id = v_e.id;

  PERFORM public.diario_obra_alimentar_semanal(v_e.diario_id);

  RETURN jsonb_build_object(
    'id', v_e.id,
    'available_at', (SELECT w.available_at
                       FROM public.weekly_reports w
                       JOIN public.diario_obra d ON d.weekly_report_id = w.id
                      WHERE d.id = v_e.diario_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.diario_obra_salvar_texto_cliente(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.diario_obra_salvar_texto_cliente(uuid, text) TO authenticated;

COMMENT ON TABLE public.diario_obra IS
  'Diário de obra (relatório de campo diário). Escrita só por diario_obra_enviar.';
COMMENT ON FUNCTION public.diario_obra_enviar(jsonb) IS
  'Envia o diário de obra: grava o relato, lança término real, marco de início e alimenta o relatório semanal do cliente.';
