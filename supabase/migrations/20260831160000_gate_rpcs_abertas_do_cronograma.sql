-- Fecha tres RPCs SECURITY DEFINER que estavam SEM checagem de autorizacao e
-- com EXECUTE concedido a PUBLIC (logo, tambem ao papel `anon`).
--
-- Estado encontrado em producao em 31/08/2026:
--
--   funcao                       | anon pode executar | tem checagem
--   -----------------------------+--------------------+-------------
--   save_project_baseline        | SIM                | NAO
--   reorder_project_activities   | SIM                | NAO
--   initialize_project_journey   | SIM                | NAO
--   replace_project_activities   | nao                | sim
--
-- Como a chave anonima do Supabase e publica (vai no bundle do frontend),
-- qualquer pessoa na internet podia chamar as tres em QUALQUER project_id:
--   * save_project_baseline      -> sobrescreve a linha de base de toda a obra
--   * reorder_project_activities -> embaralha a ordem das atividades
--   * initialize_project_journey -> injeta etapas de jornada
-- Nenhuma delas exigia sequer estar autenticado.
--
-- replace_project_activities escapou porque a migracao 20260825140418 fez
-- REVOKE ALL ... FROM PUBLIC ao adicionar o gate. As outras tres nunca foram
-- revisadas.
--
-- O gate aplicado e o MESMO de 20260831143000_fix_replace_project_activities_authz.sql:
-- a uniao do modelo legado (can_edit_atividades) com o modelo que governa a
-- tabela viva project_activities e que o frontend usa (is_staff + has_project_access,
-- ambos lendo user_roles).
--
-- Compatibilidade verificada antes de aplicar: todos os chamadores sao caminhos
-- autenticados do app (src/hooks/useProjectActivities.ts:243,
-- src/pages/editar-obra/useEditarObraData.ts:1034, src/hooks/useProjectJourney.ts:145,
-- src/infra/repositories/projects.repository.ts:889, src/pages/nova-obra/useNovaObraSubmit.ts:208,
-- src/pages/EditarObraWizard.tsx:250). Na criacao de obra, o criador entra em
-- project_members no passo 3 (useNovaObraSubmit.ts:106-109), ANTES da chamada a
-- initialize_project_journey no passo 6 — entao has_project_access ja e verdadeiro.

-- ── save_project_baseline ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_project_baseline(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL
     OR NOT (
       public.can_edit_atividades(p_project_id)
       OR (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), p_project_id))
     ) THEN
    RAISE EXCEPTION 'Sem permissão para salvar a linha de base desta obra';
  END IF;

  UPDATE public.project_activities
  SET
    baseline_start = planned_start,
    baseline_end = planned_end,
    baseline_saved_at = now()
  WHERE project_id = p_project_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_project_baseline(uuid) FROM PUBLIC;
-- REVOKE ... FROM PUBLIC nao remove a concessao DIRETA ao papel anon,
-- que o Supabase concede por default privileges. Precisa ser explicito.
REVOKE EXECUTE ON FUNCTION public.save_project_baseline(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_project_baseline(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_project_baseline(uuid) TO service_role;

-- ── reorder_project_activities ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reorder_project_activities(p_project_id uuid, p_ordered_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL
     OR NOT (
       public.can_edit_atividades(p_project_id)
       OR (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), p_project_id))
     ) THEN
    RAISE EXCEPTION 'Sem permissão para reordenar o cronograma desta obra';
  END IF;

  -- A checagem original abaixo NAO era de permissao: so verificava que a obra
  -- tinha alguma atividade. Mantida para preservar a mensagem em obra vazia.
  IF NOT EXISTS (
    SELECT 1 FROM public.project_activities
    WHERE project_id = p_project_id
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Projeto não encontrado ou sem acesso';
  END IF;

  UPDATE public.project_activities a
    SET sort_order = ord.idx
  FROM unnest(p_ordered_ids) WITH ORDINALITY AS ord(id, idx)
  WHERE a.id = ord.id
    AND a.project_id = p_project_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.reorder_project_activities(uuid, uuid[]) FROM PUBLIC;
-- REVOKE ... FROM PUBLIC nao remove a concessao DIRETA ao papel anon,
-- que o Supabase concede por default privileges. Precisa ser explicito.
REVOKE EXECUTE ON FUNCTION public.reorder_project_activities(uuid, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.reorder_project_activities(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_project_activities(uuid, uuid[]) TO service_role;

-- ── initialize_project_journey ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.initialize_project_journey(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_stage_count int;
BEGIN
  IF auth.uid() IS NULL
     OR NOT (
       public.can_edit_atividades(p_project_id)
       OR (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), p_project_id))
     ) THEN
    RAISE EXCEPTION 'Sem permissão para inicializar a jornada desta obra';
  END IF;

  SELECT count(*) INTO v_stage_count FROM journey_stages WHERE project_id = p_project_id;
  IF v_stage_count = 0 THEN
    INSERT INTO journey_stages (project_id, sort_order, name, icon, status, description)
    VALUES
      (p_project_id, 1, 'Briefing', 'message-circle', 'in_progress', 'Reunião inicial para alinhamento do projeto.'),
      (p_project_id, 2, 'Projeto 3D', 'box', 'pending', 'Desenvolvimento do projeto em 3D para aprovação.'),
      (p_project_id, 3, 'Medição Técnica', 'ruler', 'pending', 'Visita técnica para medições precisas do espaço.'),
      (p_project_id, 4, 'Projeto Executivo', 'file-text', 'pending', 'Detalhamento técnico para execução da obra.'),
      (p_project_id, 5, 'Liberação da Obra', 'shield-check', 'pending', 'Trâmites para emissão da ART e aprovação do condomínio para início da obra.'),
      (p_project_id, 6, 'Mobilização', 'hard-hat', 'pending', 'Mobilização da equipe técnica para início da obra.');
  END IF;

  -- Create hero
  INSERT INTO journey_hero (project_id, title, subtitle)
  VALUES (p_project_id, 'Jornada do Projeto', 'Acompanhe cada etapa da sua reforma')
  ON CONFLICT (project_id) DO NOTHING;

  -- Create footer
  INSERT INTO journey_footer (project_id, text)
  VALUES (p_project_id, 'Estamos com você em cada etapa.')
  ON CONFLICT (project_id) DO NOTHING;
END;
$function$;

REVOKE ALL ON FUNCTION public.initialize_project_journey(uuid) FROM PUBLIC;
-- REVOKE ... FROM PUBLIC nao remove a concessao DIRETA ao papel anon,
-- que o Supabase concede por default privileges. Precisa ser explicito.
REVOKE EXECUTE ON FUNCTION public.initialize_project_journey(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.initialize_project_journey(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_project_journey(uuid) TO service_role;
