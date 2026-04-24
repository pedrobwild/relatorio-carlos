-- Tabela de tarefas por serviço do registro diário
CREATE TABLE public.project_daily_log_service_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.project_daily_log_services(id) ON DELETE CASCADE,
  title text NOT NULL,
  responsible_user_id uuid REFERENCES public.users_profile(id) ON DELETE SET NULL,
  due_date date,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','concluido','cancelado')),
  position integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  completed_by uuid REFERENCES public.users_profile(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users_profile(id) ON DELETE SET NULL
);

CREATE INDEX idx_pdlst_service ON public.project_daily_log_service_tasks(service_id);
CREATE INDEX idx_pdlst_responsible ON public.project_daily_log_service_tasks(responsible_user_id);
CREATE INDEX idx_pdlst_status ON public.project_daily_log_service_tasks(status);

ALTER TABLE public.project_daily_log_service_tasks ENABLE ROW LEVEL SECURITY;

-- Helper: trigger para updated_at
CREATE TRIGGER trg_pdlst_updated_at
BEFORE UPDATE ON public.project_daily_log_service_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: completed_at/completed_by ao concluir
CREATE OR REPLACE FUNCTION public.pdlst_handle_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'concluido' AND (OLD.status IS DISTINCT FROM 'concluido') THEN
    NEW.completed_at := now();
    NEW.completed_by := auth.uid();
  ELSIF NEW.status <> 'concluido' AND OLD.status = 'concluido' THEN
    NEW.completed_at := NULL;
    NEW.completed_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pdlst_completion
BEFORE UPDATE ON public.project_daily_log_service_tasks
FOR EACH ROW EXECUTE FUNCTION public.pdlst_handle_completion();

-- RLS: staff pode ler/escrever todas
CREATE POLICY "Staff manage service tasks"
ON public.project_daily_log_service_tasks
FOR ALL
TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));