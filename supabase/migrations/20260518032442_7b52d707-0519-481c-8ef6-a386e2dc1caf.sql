-- Tabela de ações da semana no registro diário (Painel de Obras)
CREATE TABLE public.project_daily_log_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id uuid NOT NULL REFERENCES public.project_daily_logs(id) ON DELETE CASCADE,
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

CREATE INDEX idx_pdla_daily_log ON public.project_daily_log_actions(daily_log_id);
CREATE INDEX idx_pdla_responsible ON public.project_daily_log_actions(responsible_user_id);
CREATE INDEX idx_pdla_status ON public.project_daily_log_actions(status);

ALTER TABLE public.project_daily_log_actions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_pdla_updated_at
BEFORE UPDATE ON public.project_daily_log_actions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.pdla_handle_completion()
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

CREATE TRIGGER trg_pdla_completion
BEFORE UPDATE ON public.project_daily_log_actions
FOR EACH ROW EXECUTE FUNCTION public.pdla_handle_completion();

-- RLS: staff pode ler/escrever
CREATE POLICY "Staff manage daily log actions"
ON public.project_daily_log_actions
FOR ALL
TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));