-- Adiciona coluna responsible_user_id para definir o responsável (staff)
-- por uma atividade ou micro-etapa do cronograma da obra.
ALTER TABLE public.project_activities
  ADD COLUMN IF NOT EXISTS responsible_user_id uuid REFERENCES public.users_profile(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_activities_responsible
  ON public.project_activities (responsible_user_id)
  WHERE responsible_user_id IS NOT NULL;