-- ─────────────────────────────────────────────────────────────────────────────
-- Concluir "Mobilização" passa a PROMOVER a obra para execução,
-- em vez de clonar a obra em um card novo.
--
-- Sintoma (Gabriella, #sugestoes-portal 08/09): "obra Felipe Pedrosa e Anderson
-- Botelho já iniciamos a umas semanas e já tinha cronograma cadastrado, mas ao
-- entrar nas obra, ela voltou as etapas anteriores e não consta nosso
-- cronograma, isso está acontecendo com uma certa frequência".
--
-- Eram DOIS efeitos da mesma causa:
--
-- 1) "voltou as etapas anteriores"
--    MobilizacaoCompletionModal concluía a etapa e chamava
--    cloneProjectForConstruction(), que criava um CARD NOVO com
--    is_project_phase = false, copiava 13 tabelas (atividades, documentos,
--    financeiro, formalizações, compras...) mas NÃO copiava a jornada
--    (journey_stages / journey_hero / journey_footer / journey_csm), e ainda
--    marcava o card original como status = 'completed'.
--    Ao abrir o card novo, JornadaProjeto encontrava journey.hero nulo e
--    chamava initialize_project_journey — recriando a jornada DO ZERO, no
--    Briefing. Para a operação, a obra "voltava para as etapas anteriores";
--    o cronograma "sumia" porque parte do trabalho ficava no outro card.
--    (Foi a duplicação que o time corrigiu na mão em 17-18/08 na obra do
--    Renato Whinter, e o mesmo padrão aparece em ~15 pares de cards.)
--
-- 2) "não consta nosso cronograma"
--    A obra que NUNCA conclui Mobilização fica presa em is_project_phase = true.
--    Nesse estado o item Cronograma fica desabilitado na navegação
--    (ProjectSidebar: disabledInProjectPhase), mesmo com o cronograma salvo.
--    As duas obras citadas estão exatamente assim: 20 atividades gravadas,
--    5 de 6 etapas concluídas, Mobilização parada em in_progress.
--
-- A saída é promover a obra NO LUGAR: mesma obra, mesmo id, mesma jornada,
-- mesmo cronograma — só sai da fase de projeto. Sem card novo, sem nada para
-- "voltar".
--
-- Transição de estado, então vai para o banco em UMA transação, com
-- SECURITY DEFINER e checagem de permissão própria, conforme
-- docs/SECURITY_PATTERNS.md ("Status + histórico são escritos na mesma
-- transação"; "Nunca confiar validação de role somente no React").
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.promote_project_to_execution(
  p_project_id uuid,
  p_stage_id uuid DEFAULT NULL,
  p_planned_start_date date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_stage_sort_order int;
  v_stage_status text;
  v_next_stage_id uuid;
BEGIN
  -- Mesma união de permissão usada pelas outras RPCs do cronograma
  -- (ver 20260831160000): o modelo legado ou staff com acesso à obra.
  IF auth.uid() IS NULL
     OR NOT (
       public.can_edit_atividades(p_project_id)
       OR (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), p_project_id))
     ) THEN
    RAISE EXCEPTION 'Sem permissão para encerrar a fase de projeto desta obra';
  END IF;

  -- Trava a obra: duas pessoas concluindo Mobilização ao mesmo tempo não podem
  -- promover a mesma obra duas vezes.
  PERFORM 1 FROM projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Obra não encontrada';
  END IF;

  -- 1) Conclui a etapa informada (Mobilização), se ainda estiver aberta.
  IF p_stage_id IS NOT NULL THEN
    SELECT sort_order, status INTO v_stage_sort_order, v_stage_status
      FROM journey_stages
     WHERE id = p_stage_id AND project_id = p_project_id
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Etapa não pertence a esta obra';
    END IF;

    IF v_stage_status <> 'completed' THEN
      UPDATE journey_stages
         SET status = 'completed',
             confirmed_end = COALESCE(confirmed_end, CURRENT_DATE)
       WHERE id = p_stage_id;
    END IF;

    -- Destrava a próxima etapa, se houver — mesma regra do useCompleteStage.
    -- Mobilização é a última por padrão, mas a jornada é editável.
    SELECT id INTO v_next_stage_id
      FROM journey_stages
     WHERE project_id = p_project_id
       AND sort_order > v_stage_sort_order
       AND status = 'pending'
     ORDER BY sort_order
     LIMIT 1;

    IF v_next_stage_id IS NOT NULL THEN
      UPDATE journey_stages SET status = 'in_progress' WHERE id = v_next_stage_id;
    END IF;
  END IF;

  -- 2) Tira a obra da fase de projeto e registra os marcos a partir da jornada.
  --    COALESCE em todos os marcos: só preenche o que ainda está vazio, nunca
  --    sobrescreve data já registrada na obra.
  --    O nome da etapa é editável pelo staff, então casa por nome normalizado
  --    e aceita os apelidos que a jornada já teve ('Briefing Arquitetônico',
  --    'Aprovações' / 'Aprovações e Documentação' viraram 'Liberação da Obra').
  WITH marcos AS (
    SELECT
      max(confirmed_end) FILTER (WHERE lower(name) IN ('briefing', 'briefing arquitetônico')) AS briefing,
      max(confirmed_end) FILTER (WHERE lower(name) = 'projeto 3d') AS aprovacao_3d,
      max(confirmed_end) FILTER (WHERE lower(name) = 'projeto executivo') AS aprovacao_exec,
      max(confirmed_end) FILTER (WHERE lower(name) IN ('liberação da obra', 'aprovações', 'aprovações e documentação')) AS liberacao,
      max(confirmed_end) FILTER (WHERE lower(name) = 'mobilização') AS mobilizacao
    FROM journey_stages
    WHERE project_id = p_project_id AND status = 'completed'
  )
  UPDATE projects p
     SET is_project_phase = false,
         -- draft nunca deveria seguir para execução escondido do painel;
         -- o fluxo antigo (clone) também nascia 'active'.
         status = CASE WHEN p.status = 'draft' THEN 'active' ELSE p.status END,
         planned_start_date = COALESCE(p_planned_start_date, p.planned_start_date),
         date_briefing_arch = COALESCE(p.date_briefing_arch, marcos.briefing),
         date_approval_3d = COALESCE(p.date_approval_3d, marcos.aprovacao_3d),
         date_approval_exec = COALESCE(p.date_approval_exec, marcos.aprovacao_exec),
         date_approval_obra = COALESCE(p.date_approval_obra, marcos.liberacao),
         date_mobilization_start = COALESCE(p.date_mobilization_start, marcos.mobilizacao, CURRENT_DATE)
    FROM marcos
   WHERE p.id = p_project_id;
END;
$function$;

-- Mesma trava das RPCs de 20260831160000: a chave anônima do Supabase é
-- pública (vai no bundle), então anon não pode promover obra de ninguém.
-- REVOKE ... FROM PUBLIC não remove a concessão DIRETA ao papel anon.
REVOKE ALL ON FUNCTION public.promote_project_to_execution(uuid, uuid, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.promote_project_to_execution(uuid, uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.promote_project_to_execution(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_project_to_execution(uuid, uuid, date) TO service_role;

COMMENT ON FUNCTION public.promote_project_to_execution(uuid, uuid, date) IS
  'Encerra a fase de projeto da obra NO LUGAR (conclui a etapa de Mobilização, '
  'tira is_project_phase e grava os marcos da jornada) em uma transação. '
  'Substitui o clone em card novo, que recriava a jornada do zero e espalhava '
  'o cronograma entre dois cards.';
