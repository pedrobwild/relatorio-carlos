-- ============================================================
-- Audit log genérico para módulos de obras
-- ------------------------------------------------------------
-- Cria uma única tabela `audit_logs` que rastreia INSERT/UPDATE/DELETE
-- em tabelas relevantes (projects, project_documents, project_payments,
-- project_daily_logs, obra_tasks, journey_stage_records, stage_dates,
-- formalizations).
--
-- Estratégia:
--   - 1 tabela única (em vez de 1 tabela por entidade) -> facilita
--     timeline cronológica por obra e queries cross-modulo.
--   - Função genérica `public.log_audit_event()` reutilizada em todos
--     os triggers, descobrindo `project_id` automaticamente em cada
--     tabela auditada (estratégia case-by-case via TG_TABLE_NAME).
--   - Apenas colunas que mudaram são gravadas em `changed_columns`,
--     com diff completo em `old_values`/`new_values` (jsonb).
--   - `changed_by_email` é denormalizado para evitar JOIN em auth.users
--     na UI.
-- ============================================================

-- 1) Tabela principal --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name      TEXT NOT NULL,
  record_id       UUID NOT NULL,
  project_id      UUID NULL,                  -- denormalizado p/ filtro rápido por obra
  action          TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  changed_columns TEXT[] NULL,                -- preenchido apenas em UPDATE
  old_values      JSONB NULL,                 -- snapshot anterior (UPDATE/DELETE)
  new_values      JSONB NULL,                 -- snapshot atual (INSERT/UPDATE)
  changed_by      UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_email TEXT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_project_created
  ON public.audit_logs (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record
  ON public.audit_logs (table_name, record_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_by
  ON public.audit_logs (changed_by, created_at DESC);

COMMENT ON TABLE public.audit_logs IS
  'Trilha de auditoria genérica para mudanças em entidades ligadas a obras.';
COMMENT ON COLUMN public.audit_logs.project_id IS
  'Denormalizado: copiado da linha auditada quando aplicável (NULL para entidades sem vínculo direto).';
COMMENT ON COLUMN public.audit_logs.changed_columns IS
  'Lista de colunas alteradas. Preenchido apenas para UPDATE.';

-- 2) Função genérica de log -------------------------------------------
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_action          TEXT := TG_OP;
  v_record_id       UUID;
  v_project_id      UUID;
  v_old             JSONB;
  v_new             JSONB;
  v_changed_cols    TEXT[];
  v_user_id         UUID := auth.uid();
  v_user_email      TEXT;
BEGIN
  -- Snapshot OLD/NEW como jsonb (NULL quando não aplicável)
  IF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
  END IF;

  -- Extrai record_id (PK) — todas as tabelas auditadas usam coluna `id` UUID
  IF TG_OP = 'DELETE' THEN
    v_record_id := (v_old->>'id')::uuid;
  ELSE
    v_record_id := (v_new->>'id')::uuid;
  END IF;

  -- Extrai project_id da linha (varia por tabela)
  IF TG_TABLE_NAME = 'projects' THEN
    v_project_id := v_record_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_project_id := NULLIF(v_old->>'project_id','')::uuid;
  ELSE
    v_project_id := NULLIF(v_new->>'project_id','')::uuid;
  END IF;

  -- Calcula colunas alteradas (apenas em UPDATE)
  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(key) INTO v_changed_cols
    FROM (
      SELECT key
      FROM jsonb_each(v_new)
      WHERE key NOT IN ('updated_at')   -- ignora colunas de bookkeeping
        AND v_new->key IS DISTINCT FROM v_old->key
    ) diff;

    -- Se nada mudou (além de updated_at), não loga
    IF v_changed_cols IS NULL OR array_length(v_changed_cols,1) = 0 THEN
      RETURN COALESCE(NEW, OLD);
    END IF;
  END IF;

  -- Pega email do usuário (best-effort)
  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  END IF;

  INSERT INTO public.audit_logs (
    table_name, record_id, project_id, action,
    changed_columns, old_values, new_values,
    changed_by, changed_by_email
  ) VALUES (
    TG_TABLE_NAME, v_record_id, v_project_id, v_action,
    v_changed_cols, v_old, v_new,
    v_user_id, v_user_email
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.log_audit_event() IS
  'Trigger genérico AFTER INSERT/UPDATE/DELETE — grava em public.audit_logs.';

-- 3) Triggers em cada tabela alvo -------------------------------------
-- Helper: cria trigger somente se a tabela existir (resiliência a renames futuros).
DO $$
DECLARE
  tbl TEXT;
  target_tables TEXT[] := ARRAY[
    'projects',
    'project_documents',
    'project_payments',
    'project_daily_logs',
    'obra_tasks',
    'journey_stage_records',
    'stage_dates',
    'formalizations'
  ];
BEGIN
  FOREACH tbl IN ARRAY target_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=tbl
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I;', tbl, tbl);
      EXECUTE format(
        'CREATE TRIGGER trg_audit_%I
           AFTER INSERT OR UPDATE OR DELETE ON public.%I
           FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();',
        tbl, tbl
      );
    END IF;
  END LOOP;
END $$;

-- 4) RLS ---------------------------------------------------------------
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Leitura: staff vê tudo; demais usuários só veem logs de obras a que têm acesso.
DROP POLICY IF EXISTS "audit_logs_select_staff_or_project_access" ON public.audit_logs;
CREATE POLICY "audit_logs_select_staff_or_project_access"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR (
      project_id IS NOT NULL
      AND public.has_project_access(auth.uid(), project_id)
    )
  );

-- Escrita: bloqueada para clients. Só o trigger SECURITY DEFINER pode inserir.
-- (Sem POLICY de INSERT/UPDATE/DELETE => negado por padrão.)
