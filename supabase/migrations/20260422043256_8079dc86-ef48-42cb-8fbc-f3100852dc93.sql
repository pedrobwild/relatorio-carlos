-- Tabela para registrar dias não úteis customizados (feriados específicos / folgas)
-- Escopo:
--   * project_id IS NULL  → aplica-se a todas as obras (organizacional)
--   * project_id != NULL  → aplica-se apenas àquela obra
-- A combinação (project_id, day) deve ser única para evitar duplicatas.
CREATE TABLE IF NOT EXISTS public.project_non_working_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Unicidade: trata NULL como "global". Postgres considera NULLs distintos por
-- padrão em UNIQUE, então usamos dois índices parciais.
CREATE UNIQUE INDEX IF NOT EXISTS project_non_working_days_proj_day_key
  ON public.project_non_working_days(project_id, day)
  WHERE project_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS project_non_working_days_global_day_key
  ON public.project_non_working_days(day)
  WHERE project_id IS NULL;

CREATE INDEX IF NOT EXISTS project_non_working_days_day_idx
  ON public.project_non_working_days(day);

ALTER TABLE public.project_non_working_days ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário staff (admin, manager, engineer, etc.) pode ler.
-- Clientes não precisam acessar diretamente — a granularidade é do time interno.
CREATE POLICY "Staff can view non-working days"
  ON public.project_non_working_days
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- Escrita: apenas Admin e Engineer (mesma regra do recurso de quebrar atividades).
CREATE POLICY "Admin/Engineer can insert non-working days"
  ON public.project_non_working_days
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'engineer')
  );

CREATE POLICY "Admin/Engineer can update non-working days"
  ON public.project_non_working_days
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'engineer')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'engineer')
  );

CREATE POLICY "Admin/Engineer can delete non-working days"
  ON public.project_non_working_days
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'engineer')
  );