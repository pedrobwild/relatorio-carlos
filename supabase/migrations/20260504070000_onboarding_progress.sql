-- ============================================================
-- Onboarding contextual — progresso por usuário, papel e fase da obra
--
-- Persiste:
--   - quais passos do onboarding foram concluídos (completed_at)
--   - se o usuário dispensou o checklist para uma combinação de obra/fluxo
--
-- A unicidade `(user_id, obra_id, step_key)` permite upsert idempotente
-- direto do cliente. `obra_id` pode ser NULL para onboarding global
-- (ex.: admin sem obra ainda cadastrada).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  obra_id       UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  step_key      TEXT NOT NULL,
  completed_at  TIMESTAMPTZ,
  dismissed     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique index treats NULL obra_id as a single bucket so upserts work for
-- both project-scoped and global onboarding rows.
CREATE UNIQUE INDEX IF NOT EXISTS uq_onboarding_progress_lookup
  ON public.onboarding_progress (user_id, COALESCE(obra_id, '00000000-0000-0000-0000-000000000000'::uuid), step_key);

CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user
  ON public.onboarding_progress (user_id);

CREATE INDEX IF NOT EXISTS idx_onboarding_progress_obra
  ON public.onboarding_progress (obra_id)
  WHERE obra_id IS NOT NULL;

-- Trigger para manter updated_at fresco
CREATE OR REPLACE FUNCTION public.set_onboarding_progress_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_onboarding_progress_updated_at ON public.onboarding_progress;
CREATE TRIGGER trg_onboarding_progress_updated_at
  BEFORE UPDATE ON public.onboarding_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.set_onboarding_progress_updated_at();

-- ============================================================
-- RLS: cada usuário lê e grava apenas o próprio progresso
-- ============================================================

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own onboarding progress" ON public.onboarding_progress;
CREATE POLICY "Users read own onboarding progress"
  ON public.onboarding_progress FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own onboarding progress" ON public.onboarding_progress;
CREATE POLICY "Users insert own onboarding progress"
  ON public.onboarding_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own onboarding progress" ON public.onboarding_progress;
CREATE POLICY "Users update own onboarding progress"
  ON public.onboarding_progress FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own onboarding progress" ON public.onboarding_progress;
CREATE POLICY "Users delete own onboarding progress"
  ON public.onboarding_progress FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.onboarding_progress IS
  'Progresso de onboarding contextual por usuário, opcionalmente por obra. step_key referencia src/content/onboardingFlows.ts';
