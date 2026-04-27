-- Enum de status para ações do ticket
DO $$ BEGIN
  CREATE TYPE public.cs_action_status AS ENUM ('pendente', 'em_andamento', 'concluida', 'cancelada');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Tabela de ações de um ticket de CS
CREATE TABLE IF NOT EXISTS public.cs_ticket_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.cs_tickets(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  responsible_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date date,
  status public.cs_action_status NOT NULL DEFAULT 'pendente',
  sort_order int NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cs_ticket_actions_ticket ON public.cs_ticket_actions(ticket_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_cs_ticket_actions_status ON public.cs_ticket_actions(status);
CREATE INDEX IF NOT EXISTS idx_cs_ticket_actions_due ON public.cs_ticket_actions(due_date);
CREATE INDEX IF NOT EXISTS idx_cs_ticket_actions_responsible ON public.cs_ticket_actions(responsible_user_id);

-- updated_at
DROP TRIGGER IF EXISTS trg_cs_ticket_actions_updated_at ON public.cs_ticket_actions;
CREATE TRIGGER trg_cs_ticket_actions_updated_at
  BEFORE UPDATE ON public.cs_ticket_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- completed_at automático ao concluir / limpa ao reabrir
CREATE OR REPLACE FUNCTION public.cs_ticket_actions_set_completed_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'concluida' AND NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'concluida' AND (OLD.status IS DISTINCT FROM 'concluida') THEN
    NEW.completed_at := now();
  ELSIF NEW.status <> 'concluida' AND OLD.status = 'concluida' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cs_ticket_actions_completed_at ON public.cs_ticket_actions;
CREATE TRIGGER trg_cs_ticket_actions_completed_at
  BEFORE INSERT OR UPDATE ON public.cs_ticket_actions
  FOR EACH ROW EXECUTE FUNCTION public.cs_ticket_actions_set_completed_at();

-- RLS — staff completo
ALTER TABLE public.cs_ticket_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view cs ticket actions" ON public.cs_ticket_actions;
CREATE POLICY "Staff can view cs ticket actions"
  ON public.cs_ticket_actions
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can insert cs ticket actions" ON public.cs_ticket_actions;
CREATE POLICY "Staff can insert cs ticket actions"
  ON public.cs_ticket_actions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Staff can update cs ticket actions" ON public.cs_ticket_actions;
CREATE POLICY "Staff can update cs ticket actions"
  ON public.cs_ticket_actions
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can delete cs ticket actions" ON public.cs_ticket_actions;
CREATE POLICY "Staff can delete cs ticket actions"
  ON public.cs_ticket_actions
  FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));