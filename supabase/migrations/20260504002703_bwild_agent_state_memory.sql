-- ============================================================
-- BWILD Agent — memória stateful por projeto + log de eventos
--
-- Suporta a Edge Function `bwild-agent` (orquestrador + especialistas).
-- A spec autoritativa do sistema vive em docs/BWILD_AI_AGENTS_SPEC.yaml.
--
-- Modelo:
--   project_state_memory  1:1 projects     — snapshot do estado atual do projeto
--   bwild_agent_events    N:1 projects     — log append-only de eventos/respostas
-- ============================================================

-- ----------------------------------------------------------------
-- 1. project_state_memory
-- Um registro por projeto. O conteúdo `state` segue o schema da seção
-- `state_memory` da spec (project_context, technical_scope,
-- design_status, schedule_state, financial_state, procurement_state,
-- execution_state, quality_state, communication_state).
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_state_memory (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  state       JSONB NOT NULL DEFAULT '{}'::jsonb,
  version     INTEGER NOT NULL DEFAULT 1,
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_state_memory_project UNIQUE (project_id)
);

CREATE INDEX IF NOT EXISTS idx_state_memory_project
  ON public.project_state_memory(project_id);

-- updated_at maintained by trigger
CREATE OR REPLACE FUNCTION public.tg_state_memory_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.version := COALESCE(OLD.version, 0) + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_state_memory_updated_at ON public.project_state_memory;
CREATE TRIGGER trg_state_memory_updated_at
  BEFORE UPDATE ON public.project_state_memory
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_state_memory_set_updated_at();

ALTER TABLE public.project_state_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view project state memory" ON public.project_state_memory;
CREATE POLICY "Staff view project state memory"
  ON public.project_state_memory
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- Escrita feita pela Edge Function (service_role bypassa RLS).
-- Mantemos uma policy de UPDATE/INSERT para staff caso seja necessário
-- editar manualmente via cliente autenticado.
DROP POLICY IF EXISTS "Staff insert project state memory" ON public.project_state_memory;
CREATE POLICY "Staff insert project state memory"
  ON public.project_state_memory
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff update project state memory" ON public.project_state_memory;
CREATE POLICY "Staff update project state memory"
  ON public.project_state_memory
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- ----------------------------------------------------------------
-- 2. bwild_agent_events
-- Log append-only de cada chamada ao agente (input + classificação
-- + resposta + telemetria). Serve para auditoria, replay e analytics.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bwild_agent_events (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type      TEXT NOT NULL,
  source          TEXT,
  content         TEXT NOT NULL,
  routed_agent    TEXT,
  response        JSONB,
  state_diff      JSONB,
  state_version   INTEGER,
  model           TEXT,
  tokens_input    INTEGER NOT NULL DEFAULT 0,
  tokens_output   INTEGER NOT NULL DEFAULT 0,
  latency_ms      INTEGER,
  status          TEXT NOT NULL DEFAULT 'success',
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_agent_event_type CHECK (event_type IN (
    'new_project',
    'project_update',
    'schedule_request',
    'budget_request',
    'field_problem',
    'client_message',
    'supplier_quote',
    'purchase_decision',
    'quality_inspection',
    'scope_change',
    'handover'
  )),
  CONSTRAINT chk_agent_event_status CHECK (status IN (
    'success', 'llm_error', 'state_error', 'auth_error', 'other'
  ))
);

CREATE INDEX IF NOT EXISTS idx_agent_events_project_created
  ON public.bwild_agent_events(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_events_routed_agent
  ON public.bwild_agent_events(routed_agent);

ALTER TABLE public.bwild_agent_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view agent events" ON public.bwild_agent_events;
CREATE POLICY "Staff view agent events"
  ON public.bwild_agent_events
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- Insert é via service_role na Edge Function. Mantemos policy
-- de insert para staff (debug manual).
DROP POLICY IF EXISTS "Staff insert agent events" ON public.bwild_agent_events;
CREATE POLICY "Staff insert agent events"
  ON public.bwild_agent_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND user_id = auth.uid());
