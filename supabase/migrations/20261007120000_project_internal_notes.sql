-- Observações internas da obra (canal da equipe).
--
-- POR QUE ISTO EXISTE
-- Quando uma obra fica dias sem atualização, o time de obras sabe o motivo
-- (cliente viajando, aguardando material, obra pausada…), mas o time de
-- Customer Success não — e o cliente cobra. Não havia lugar no portal para
-- registrar esse contexto sem que o cliente visse.
--
-- REGRA DE OURO: o cliente NUNCA lê estas notas. Todas as policies exigem
-- public.is_staff(). Não usar has_project_access() sozinho: ele é verdadeiro
-- para o cliente da obra (project_customers / project_members 'viewer').
--
-- Qualquer colaborador (obras, CS, gestão…) lê e escreve em qualquer obra —
-- mesmo padrão de cs_tickets e internal_weekly_reports — para o CS enxergar
-- o contexto de obras onde não é membro.
--
-- Cada obra tem no máximo UMA nota fixada ("status atual"). Fixar uma nota
-- desafixa a anterior (trigger). Qualquer colaborador pode fixar/desafixar
-- via RPC; editar e apagar ficam com o autor (ou admin/gestor).

CREATE TABLE IF NOT EXISTS public.project_internal_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  -- Preenchidos pelo trigger a partir de auth.uid(); o cliente não escolhe.
  author_id   uuid NOT NULL DEFAULT auth.uid(),
  author_name text NOT NULL DEFAULT '',
  body        text NOT NULL
    CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
  category    text NOT NULL DEFAULT 'outro'
    CHECK (category IN (
      'sem_atualizacao',
      'aguardando_cliente',
      'aguardando_material',
      'obra_pausada',
      'outro'
    )),
  is_pinned   boolean NOT NULL DEFAULT false,
  edited_at   timestamptz,
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.project_internal_notes IS
  'Observações internas por obra. Visível apenas para staff (is_staff); o cliente nunca lê.';

-- Feed da obra: mais recentes primeiro.
CREATE INDEX IF NOT EXISTS idx_project_internal_notes_project
  ON public.project_internal_notes (project_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- No máximo uma nota fixada por obra (o Painel mostra exatamente essa).
CREATE UNIQUE INDEX IF NOT EXISTS uq_project_internal_notes_pinned
  ON public.project_internal_notes (project_id)
  WHERE is_pinned AND deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- Trigger: autoria, imutabilidade e "uma fixada por obra"
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER porque:
--   * lê o nome do autor em users_profile (cuja RLS não deixa staff comum
--     ler o perfil de outro colaborador);
--   * desafixa a nota anterior, que pode ser de outro autor (a policy de
--     UPDATE não permitiria).
CREATE OR REPLACE FUNCTION public.project_internal_notes_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- auth.uid() é nulo só para service_role; aí vale o author_id enviado.
    NEW.author_id := COALESCE(auth.uid(), NEW.author_id);
    IF NEW.author_id IS NULL THEN
      RAISE EXCEPTION 'Autor da observação interna não identificado'
        USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(
      NULLIF(btrim(up.nome), ''),
      NULLIF(btrim(p.display_name), ''),
      NULLIF(btrim(u.email), ''),
      'Colaborador'
    )
    INTO NEW.author_name
    FROM auth.users u
    LEFT JOIN public.users_profile up ON up.id = u.id
    LEFT JOIN public.profiles p ON p.user_id = u.id
    WHERE u.id = NEW.author_id
    LIMIT 1;
    NEW.author_name := COALESCE(NEW.author_name, 'Colaborador');

    NEW.body := btrim(NEW.body);
    NEW.edited_at := NULL;
    NEW.deleted_at := NULL;
    NEW.created_at := now();
    NEW.updated_at := now();
  ELSE
    -- Campos de identidade e autoria não mudam depois de criados.
    NEW.id := OLD.id;
    NEW.project_id := OLD.project_id;
    NEW.author_id := OLD.author_id;
    NEW.author_name := OLD.author_name;
    NEW.created_at := OLD.created_at;
    NEW.body := btrim(NEW.body);
    -- Apagar é definitivo pela API (sem "desapagar").
    IF OLD.deleted_at IS NOT NULL THEN
      NEW.deleted_at := OLD.deleted_at;
    END IF;
    IF NEW.body IS DISTINCT FROM OLD.body
       OR NEW.category IS DISTINCT FROM OLD.category THEN
      NEW.edited_at := now();
    ELSE
      NEW.edited_at := OLD.edited_at;
    END IF;
    NEW.updated_at := now();
  END IF;

  -- Nota apagada nunca fica fixada.
  IF NEW.deleted_at IS NOT NULL THEN
    NEW.is_pinned := false;
  END IF;

  -- Fixar esta desafixa a anterior da mesma obra. O lock por obra serializa
  -- fixações simultâneas: sem ele, a segunda não enxerga a primeira (ainda
  -- não commitada) e esbarra no índice único em vez de substituí-la.
  IF NEW.is_pinned AND (TG_OP = 'INSERT' OR NOT OLD.is_pinned) THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended('project_internal_notes_pin:' || NEW.project_id::text, 0)
    );
    UPDATE public.project_internal_notes
       SET is_pinned = false
     WHERE project_id = NEW.project_id
       AND is_pinned
       AND id <> NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.project_internal_notes_before_write() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_project_internal_notes_before_write ON public.project_internal_notes;
CREATE TRIGGER trg_project_internal_notes_before_write
  BEFORE INSERT OR UPDATE ON public.project_internal_notes
  FOR EACH ROW EXECUTE FUNCTION public.project_internal_notes_before_write();

-- ----------------------------------------------------------------------------
-- RLS — apenas staff. Cliente NÃO vê.
-- ----------------------------------------------------------------------------
REVOKE ALL ON public.project_internal_notes FROM PUBLIC, anon;
-- Sem DELETE físico: exclusão é lógica (deleted_at).
GRANT SELECT, INSERT, UPDATE ON public.project_internal_notes TO authenticated;
GRANT ALL ON public.project_internal_notes TO service_role;

ALTER TABLE public.project_internal_notes ENABLE ROW LEVEL SECURITY;

-- SELECT não filtra deleted_at de propósito: o UPDATE ... RETURNING do
-- soft delete revalida a linha nova contra esta policy. O filtro fica na query.
DROP POLICY IF EXISTS "Staff lê observações internas" ON public.project_internal_notes;
CREATE POLICY "Staff lê observações internas"
  ON public.project_internal_notes FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff cria observações internas" ON public.project_internal_notes;
CREATE POLICY "Staff cria observações internas"
  ON public.project_internal_notes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND author_id = auth.uid());

DROP POLICY IF EXISTS "Autor ou admin/gestor edita observações internas" ON public.project_internal_notes;
CREATE POLICY "Autor ou admin/gestor edita observações internas"
  ON public.project_internal_notes FOR UPDATE
  TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND (
      author_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gestor')
    )
  )
  WITH CHECK (
    public.is_staff(auth.uid())
    AND (
      author_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'gestor')
    )
  );

-- ----------------------------------------------------------------------------
-- RPC: fixar / desafixar (qualquer colaborador)
-- ----------------------------------------------------------------------------
-- A nota fixada é o "status atual" da obra para o time inteiro; quem atualiza
-- o status não precisa ser o autor da nota.
CREATE OR REPLACE FUNCTION public.set_project_internal_note_pinned(
  p_note_id uuid,
  p_pinned boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas a equipe pode fixar observações internas'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.project_internal_notes
     SET is_pinned = COALESCE(p_pinned, false)
   WHERE id = p_note_id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Observação interna não encontrada'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_project_internal_note_pinned(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_project_internal_note_pinned(uuid, boolean) TO authenticated;

-- ----------------------------------------------------------------------------
-- Realtime — o feed atualiza sozinho para quem está com a obra aberta.
-- O Realtime aplica a RLS acima: cliente não recebe eventos.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'project_internal_notes'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_internal_notes;
  END IF;
END $$;
