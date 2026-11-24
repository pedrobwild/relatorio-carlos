-- =====================================================================
-- MENÇÕES E PENDÊNCIAS nas observações internas da obra
--
-- POR QUE ISTO EXISTE
-- O coordenador registra "obra parada por falta de material" nas
-- observações internas e ninguém é avisado: a informação fica semanas sem
-- dono. Agora dá para marcar alguém da equipe com @; a pessoa é avisada no
-- portal, vê a pendência em "Pendências comigo" e marca como resolvida.
--
-- O QUE FAZ
--   1. `project_internal_note_mentions`: uma linha por pessoa marcada em uma
--      observação. Guarda quem pediu, quando, e a resolução (quem, quando,
--      resposta). Nada é apagado: menção retirada ou de observação removida
--      fica ARQUIVADA (`archived_at`).
--   2. `set_project_internal_note_mentions(nota, pessoas[])`: define quem
--      está marcado na observação. Só o autor (ou admin/gestor). Só equipe
--      pode ser marcada — cliente nunca. Cada pessoa nova recebe um aviso.
--   3. `resolve_project_internal_note_mention(menção, resposta)`: só quem
--      foi marcado resolve; quem pediu é avisado.
--   4. Observação removida (soft delete) arquiva as menções abertas dela.
--
-- REGRA DE OURO (a mesma das observações internas)
-- O cliente NUNCA lê menção. A única policy é de leitura e exige
-- public.is_staff(). Não há policy de escrita: tudo entra pelas RPCs
-- SECURITY DEFINER, que conferem is_staff de quem chama E de quem é marcado.
-- Os avisos vão só para equipe (notifications é lida só pelo próprio dono).
-- Idempotente.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.project_internal_note_mentions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id           uuid NOT NULL REFERENCES public.project_internal_notes(id) ON DELETE CASCADE,
  project_id        uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL,
  mentioned_name    text NOT NULL DEFAULT '',
  requested_by      uuid NOT NULL,
  requested_by_name text NOT NULL DEFAULT '',
  created_at        timestamptz NOT NULL DEFAULT now(),
  resolved_at       timestamptz,
  resolved_by       uuid,
  resolved_by_name  text,
  resolution_note   text CHECK (resolution_note IS NULL OR char_length(resolution_note) <= 1000),
  archived_at       timestamptz,
  CONSTRAINT project_internal_note_mentions_unique UNIQUE (note_id, mentioned_user_id),
  CONSTRAINT project_internal_note_mentions_resolucao
    CHECK ((resolved_at IS NULL) = (resolved_by IS NULL))
);

COMMENT ON TABLE public.project_internal_note_mentions IS
  'Pessoas da equipe marcadas em observações internas. Visível apenas para staff; o cliente nunca lê.';

-- "Pendências comigo" e "o que eu pedi": só o que está aberto.
CREATE INDEX IF NOT EXISTS idx_internal_note_mentions_open_mentioned
  ON public.project_internal_note_mentions (mentioned_user_id, created_at)
  WHERE resolved_at IS NULL AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_internal_note_mentions_open_requester
  ON public.project_internal_note_mentions (requested_by, created_at)
  WHERE resolved_at IS NULL AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_internal_note_mentions_project
  ON public.project_internal_note_mentions (project_id, created_at DESC);

-- ---------------------------------------------------------------------
-- RLS — apenas staff lê. Ninguém escreve direto.
-- ---------------------------------------------------------------------
REVOKE ALL ON public.project_internal_note_mentions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.project_internal_note_mentions TO authenticated;
GRANT ALL ON public.project_internal_note_mentions TO service_role;

ALTER TABLE public.project_internal_note_mentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff lê menções internas" ON public.project_internal_note_mentions;
CREATE POLICY "Staff lê menções internas"
  ON public.project_internal_note_mentions FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- ---------------------------------------------------------------------
-- Nome de exibição de alguém da equipe (mesma ordem do autor da observação).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.internal_staff_display_name(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT COALESCE(
        NULLIF(btrim(up.nome), ''),
        NULLIF(btrim(p.display_name), ''),
        NULLIF(btrim(u.email), '')
      )
      FROM auth.users u
      LEFT JOIN public.users_profile up ON up.id = u.id
      LEFT JOIN public.profiles p ON p.user_id = u.id
     WHERE u.id = p_user_id
     LIMIT 1),
    'Colaborador'
  )
$$;

REVOKE ALL ON FUNCTION public.internal_staff_display_name(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- RPC: definir quem está marcado na observação
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_project_internal_note_mentions(
  p_note_id uuid,
  p_user_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_note public.project_internal_notes;
  v_ids uuid[];
  v_id uuid;
  v_existing public.project_internal_note_mentions;
  v_project_name text;
  v_author text;
  v_new integer := 0;
  v_notify boolean;
BEGIN
  IF v_uid IS NULL OR NOT public.is_staff(v_uid) THEN
    RAISE EXCEPTION 'Apenas a equipe pode marcar pessoas em observações internas'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_note FROM public.project_internal_notes WHERE id = p_note_id AND deleted_at IS NULL;
  IF v_note.id IS NULL THEN
    RAISE EXCEPTION 'Observação interna não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF v_note.author_id <> v_uid
     AND NOT public.has_role(v_uid, 'admin')
     AND NOT public.has_role(v_uid, 'gestor') THEN
    RAISE EXCEPTION 'Só quem escreveu a observação pode marcar pessoas nela'
      USING ERRCODE = '42501';
  END IF;

  -- Sem repetição e sem marcar a si mesmo.
  SELECT COALESCE(array_agg(DISTINCT x), '{}') INTO v_ids
  FROM unnest(COALESCE(p_user_ids, '{}')) AS x
  WHERE x IS NOT NULL AND x <> v_note.author_id;

  IF array_length(v_ids, 1) > 10 THEN
    RAISE EXCEPTION 'Marque no máximo 10 pessoas por observação' USING ERRCODE = '22023';
  END IF;

  SELECT name INTO v_project_name FROM public.projects WHERE id = v_note.project_id;
  v_author := public.internal_staff_display_name(v_note.author_id);

  FOREACH v_id IN ARRAY v_ids
  LOOP
    -- Cliente nunca é marcável: só quem é da equipe.
    IF NOT public.is_staff(v_id) THEN
      RAISE EXCEPTION 'Só é possível marcar pessoas da equipe' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_existing
    FROM public.project_internal_note_mentions
    WHERE note_id = p_note_id AND mentioned_user_id = v_id
    FOR UPDATE;

    v_notify := false;
    IF v_existing.id IS NULL THEN
      INSERT INTO public.project_internal_note_mentions (
        note_id, project_id, mentioned_user_id, mentioned_name, requested_by, requested_by_name
      ) VALUES (
        p_note_id, v_note.project_id, v_id, public.internal_staff_display_name(v_id),
        v_note.author_id, v_author
      );
      v_notify := true;
    ELSIF v_existing.archived_at IS NOT NULL AND v_existing.resolved_at IS NULL THEN
      -- Tinha sido retirada e voltou: reabre e avisa de novo.
      UPDATE public.project_internal_note_mentions
         SET archived_at = NULL, created_at = now()
       WHERE id = v_existing.id;
      v_notify := true;
    END IF;

    IF v_notify THEN
      v_new := v_new + 1;
      PERFORM public.create_notification(
        v_id,
        'internal_mention',
        v_author || ' marcou você em ' || COALESCE(v_project_name, 'uma obra'),
        left(v_note.body, 180),
        v_note.project_id,
        '/gestao/minha-semana'
      );
    END IF;
  END LOOP;

  -- Quem saiu da lista e ainda estava em aberto: arquiva (não apaga).
  UPDATE public.project_internal_note_mentions
     SET archived_at = now()
   WHERE note_id = p_note_id
     AND resolved_at IS NULL
     AND archived_at IS NULL
     AND NOT (mentioned_user_id = ANY (v_ids));

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.set_project_internal_note_mentions(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_project_internal_note_mentions(uuid, uuid[]) TO authenticated;

-- ---------------------------------------------------------------------
-- RPC: resolver a pendência (só quem foi marcado)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_project_internal_note_mention(
  p_mention_id uuid,
  p_resposta text DEFAULT NULL
)
RETURNS public.project_internal_note_mentions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_m public.project_internal_note_mentions;
  v_resposta text := NULLIF(left(btrim(COALESCE(p_resposta, '')), 1000), '');
  v_name text;
  v_project_name text;
BEGIN
  IF v_uid IS NULL OR NOT public.is_staff(v_uid) THEN
    RAISE EXCEPTION 'Apenas a equipe pode resolver pendências internas' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_m FROM public.project_internal_note_mentions WHERE id = p_mention_id FOR UPDATE;
  IF v_m.id IS NULL OR v_m.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Pendência não encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF v_m.mentioned_user_id <> v_uid THEN
    RAISE EXCEPTION 'Só quem foi marcado pode resolver esta pendência' USING ERRCODE = '42501';
  END IF;
  IF v_m.resolved_at IS NOT NULL THEN
    RETURN v_m; -- já resolvida: o registro de quem e quando não muda
  END IF;

  v_name := public.internal_staff_display_name(v_uid);

  UPDATE public.project_internal_note_mentions
     SET resolved_at = now(),
         resolved_by = v_uid,
         resolved_by_name = v_name,
         resolution_note = v_resposta
   WHERE id = v_m.id
  RETURNING * INTO v_m;

  IF v_m.requested_by <> v_uid AND public.is_staff(v_m.requested_by) THEN
    SELECT name INTO v_project_name FROM public.projects WHERE id = v_m.project_id;
    PERFORM public.create_notification(
      v_m.requested_by,
      'internal_mention',
      v_name || ' resolveu a pendência em ' || COALESCE(v_project_name, 'uma obra'),
      COALESCE(v_resposta, 'Marcada como resolvida.'),
      v_m.project_id,
      '/gestao/minha-semana'
    );
  END IF;

  RETURN v_m;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_project_internal_note_mention(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_project_internal_note_mention(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------
-- Observação removida: as menções abertas dela saem das listas (arquivadas).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.project_internal_notes_archive_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.project_internal_note_mentions
       SET archived_at = now()
     WHERE note_id = NEW.id
       AND resolved_at IS NULL
       AND archived_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.project_internal_notes_archive_mentions() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_project_internal_notes_archive_mentions ON public.project_internal_notes;
CREATE TRIGGER trg_project_internal_notes_archive_mentions
  AFTER UPDATE OF deleted_at ON public.project_internal_notes
  FOR EACH ROW EXECUTE FUNCTION public.project_internal_notes_archive_mentions();

-- ---------------------------------------------------------------------
-- Realtime: a lista de pendências atualiza sozinha. O Realtime aplica a RLS
-- acima: cliente não recebe eventos.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'project_internal_note_mentions'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_internal_note_mentions;
  END IF;
END $$;
