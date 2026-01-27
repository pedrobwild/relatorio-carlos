-- Persistência de relatórios semanais (por obra + semana)

CREATE TABLE IF NOT EXISTS public.weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  available_at timestamptz,
  data jsonb NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekly_reports_week_number_positive CHECK (week_number > 0)
);

-- 1 relatório por semana por obra
CREATE UNIQUE INDEX IF NOT EXISTS weekly_reports_project_week_unique
  ON public.weekly_reports(project_id, week_number);

CREATE INDEX IF NOT EXISTS weekly_reports_project_id_idx
  ON public.weekly_reports(project_id);

CREATE INDEX IF NOT EXISTS weekly_reports_available_at_idx
  ON public.weekly_reports(available_at);

-- RLS
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

-- Função helper: manter updated_at e preencher campos derivados
CREATE OR REPLACE FUNCTION public.weekly_reports_set_fields()
RETURNS trigger AS $$
BEGIN
  -- Preenche available_at: 1 dia após o fim da semana, às 20:00 (horário de Brasília)
  IF NEW.available_at IS NULL THEN
    NEW.available_at := ((NEW.week_end::timestamp + interval '1 day' + interval '20 hours') AT TIME ZONE 'America/Sao_Paulo');
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS NULL THEN
      NEW.created_by := auth.uid();
    END IF;
    IF NEW.created_at IS NULL THEN
      NEW.created_at := now();
    END IF;
  END IF;

  NEW.updated_by := auth.uid();
  NEW.updated_at := now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_weekly_reports_set_fields ON public.weekly_reports;
CREATE TRIGGER trg_weekly_reports_set_fields
BEFORE INSERT OR UPDATE ON public.weekly_reports
FOR EACH ROW
EXECUTE FUNCTION public.weekly_reports_set_fields();

-- Policies
DROP POLICY IF EXISTS "weekly_reports_select" ON public.weekly_reports;
DROP POLICY IF EXISTS "weekly_reports_insert" ON public.weekly_reports;
DROP POLICY IF EXISTS "weekly_reports_update" ON public.weekly_reports;
DROP POLICY IF EXISTS "weekly_reports_delete" ON public.weekly_reports;

-- Leitura: precisa ter acesso ao projeto; cliente só vê quando disponível; staff vê sempre
CREATE POLICY "weekly_reports_select"
ON public.weekly_reports
FOR SELECT
USING (
  public.has_project_access(project_id, auth.uid())
  AND (
    public.is_staff(auth.uid())
    OR available_at <= now()
  )
);

-- Escrita: apenas staff com acesso ao projeto
CREATE POLICY "weekly_reports_insert"
ON public.weekly_reports
FOR INSERT
WITH CHECK (
  public.is_staff(auth.uid())
  AND public.has_project_access(project_id, auth.uid())
);

CREATE POLICY "weekly_reports_update"
ON public.weekly_reports
FOR UPDATE
USING (
  public.is_staff(auth.uid())
  AND public.has_project_access(project_id, auth.uid())
)
WITH CHECK (
  public.is_staff(auth.uid())
  AND public.has_project_access(project_id, auth.uid())
);

CREATE POLICY "weekly_reports_delete"
ON public.weekly_reports
FOR DELETE
USING (
  public.is_staff(auth.uid())
  AND public.has_project_access(project_id, auth.uid())
);
