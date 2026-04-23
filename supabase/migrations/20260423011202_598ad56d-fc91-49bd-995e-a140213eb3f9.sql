-- Registro diário de obra: tabela principal + filhas + triggers + RLS

CREATE TABLE IF NOT EXISTS public.project_daily_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  log_date     date NOT NULL DEFAULT CURRENT_DATE,
  notes        text,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_daily_logs_project_date_unique UNIQUE (project_id, log_date)
);

CREATE INDEX IF NOT EXISTS project_daily_logs_project_id_idx
  ON public.project_daily_logs (project_id, log_date DESC);

CREATE TABLE IF NOT EXISTS public.project_daily_log_services (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id    uuid NOT NULL REFERENCES public.project_daily_logs(id) ON DELETE CASCADE,
  description     text NOT NULL,
  status          text,
  observations    text,
  position        smallint NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_daily_log_services_log_id_idx
  ON public.project_daily_log_services (daily_log_id, position);

CREATE TABLE IF NOT EXISTS public.project_daily_log_workers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id    uuid NOT NULL REFERENCES public.project_daily_logs(id) ON DELETE CASCADE,
  name            text NOT NULL,
  role            text,
  period_start    date,
  period_end      date,
  shift_start     time,
  shift_end       time,
  notes           text,
  position        smallint NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_daily_log_workers_log_id_idx
  ON public.project_daily_log_workers (daily_log_id, position);

-- Triggers
CREATE OR REPLACE FUNCTION public.touch_project_daily_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_daily_logs_touch ON public.project_daily_logs;
CREATE TRIGGER trg_project_daily_logs_touch
BEFORE UPDATE ON public.project_daily_logs
FOR EACH ROW
EXECUTE FUNCTION public.touch_project_daily_log();

CREATE OR REPLACE FUNCTION public.bump_project_last_painel_update_from_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'project_daily_logs' THEN
    v_project_id := COALESCE(NEW.project_id, OLD.project_id);
  ELSE
    SELECT l.project_id INTO v_project_id
    FROM public.project_daily_logs l
    WHERE l.id = COALESCE(NEW.daily_log_id, OLD.daily_log_id);
  END IF;

  IF v_project_id IS NOT NULL THEN
    UPDATE public.projects
      SET painel_ultima_atualizacao = now()
    WHERE id = v_project_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_project_daily_logs_bump ON public.project_daily_logs;
CREATE TRIGGER trg_project_daily_logs_bump
AFTER INSERT OR UPDATE OR DELETE ON public.project_daily_logs
FOR EACH ROW
EXECUTE FUNCTION public.bump_project_last_painel_update_from_log();

DROP TRIGGER IF EXISTS trg_project_daily_log_services_bump ON public.project_daily_log_services;
CREATE TRIGGER trg_project_daily_log_services_bump
AFTER INSERT OR UPDATE OR DELETE ON public.project_daily_log_services
FOR EACH ROW
EXECUTE FUNCTION public.bump_project_last_painel_update_from_log();

DROP TRIGGER IF EXISTS trg_project_daily_log_workers_bump ON public.project_daily_log_workers;
CREATE TRIGGER trg_project_daily_log_workers_bump
AFTER INSERT OR UPDATE OR DELETE ON public.project_daily_log_workers
FOR EACH ROW
EXECUTE FUNCTION public.bump_project_last_painel_update_from_log();

-- RLS
ALTER TABLE public.project_daily_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_daily_log_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_daily_log_workers  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff pode visualizar logs diários" ON public.project_daily_logs;
CREATE POLICY "Staff pode visualizar logs diários"
  ON public.project_daily_logs FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff pode inserir logs diários" ON public.project_daily_logs;
CREATE POLICY "Staff pode inserir logs diários"
  ON public.project_daily_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff pode atualizar logs diários" ON public.project_daily_logs;
CREATE POLICY "Staff pode atualizar logs diários"
  ON public.project_daily_logs FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admin pode deletar logs diários" ON public.project_daily_logs;
CREATE POLICY "Admin pode deletar logs diários"
  ON public.project_daily_logs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Staff pode visualizar serviços do log" ON public.project_daily_log_services;
CREATE POLICY "Staff pode visualizar serviços do log"
  ON public.project_daily_log_services FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff pode inserir serviços do log" ON public.project_daily_log_services;
CREATE POLICY "Staff pode inserir serviços do log"
  ON public.project_daily_log_services FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff pode atualizar serviços do log" ON public.project_daily_log_services;
CREATE POLICY "Staff pode atualizar serviços do log"
  ON public.project_daily_log_services FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff pode deletar serviços do log" ON public.project_daily_log_services;
CREATE POLICY "Staff pode deletar serviços do log"
  ON public.project_daily_log_services FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff pode visualizar prestadores do log" ON public.project_daily_log_workers;
CREATE POLICY "Staff pode visualizar prestadores do log"
  ON public.project_daily_log_workers FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff pode inserir prestadores do log" ON public.project_daily_log_workers;
CREATE POLICY "Staff pode inserir prestadores do log"
  ON public.project_daily_log_workers FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff pode atualizar prestadores do log" ON public.project_daily_log_workers;
CREATE POLICY "Staff pode atualizar prestadores do log"
  ON public.project_daily_log_workers FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff pode deletar prestadores do log" ON public.project_daily_log_workers;
CREATE POLICY "Staff pode deletar prestadores do log"
  ON public.project_daily_log_workers FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));