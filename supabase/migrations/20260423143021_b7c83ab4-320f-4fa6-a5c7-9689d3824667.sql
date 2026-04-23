-- Enums para severidade e status do ticket de CS
DO $$ BEGIN
  CREATE TYPE public.cs_ticket_severity AS ENUM ('baixa', 'media', 'alta', 'critica');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.cs_ticket_status AS ENUM ('aberto', 'em_andamento', 'concluido');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Tabela principal de tickets
CREATE TABLE IF NOT EXISTS public.cs_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  situation text NOT NULL,
  description text,
  severity public.cs_ticket_severity NOT NULL DEFAULT 'media',
  status public.cs_ticket_status NOT NULL DEFAULT 'aberto',
  action_plan text,
  responsible_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cs_tickets_project_id ON public.cs_tickets(project_id);
CREATE INDEX IF NOT EXISTS idx_cs_tickets_status ON public.cs_tickets(status);
CREATE INDEX IF NOT EXISTS idx_cs_tickets_severity ON public.cs_tickets(severity);
CREATE INDEX IF NOT EXISTS idx_cs_tickets_responsible ON public.cs_tickets(responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_cs_tickets_created_at ON public.cs_tickets(created_at DESC);

-- Trigger de updated_at
DROP TRIGGER IF EXISTS trg_cs_tickets_updated_at ON public.cs_tickets;
CREATE TRIGGER trg_cs_tickets_updated_at
  BEFORE UPDATE ON public.cs_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para resolved_at quando concluir
CREATE OR REPLACE FUNCTION public.cs_tickets_set_resolved_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'concluido' AND (OLD.status IS DISTINCT FROM 'concluido') THEN
    NEW.resolved_at := now();
  ELSIF NEW.status <> 'concluido' AND OLD.status = 'concluido' THEN
    NEW.resolved_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cs_tickets_resolved_at ON public.cs_tickets;
CREATE TRIGGER trg_cs_tickets_resolved_at
  BEFORE UPDATE ON public.cs_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.cs_tickets_set_resolved_at();

-- RLS
ALTER TABLE public.cs_tickets ENABLE ROW LEVEL SECURITY;

-- Toda equipe staff pode visualizar
DROP POLICY IF EXISTS "Staff can view cs tickets" ON public.cs_tickets;
CREATE POLICY "Staff can view cs tickets"
  ON public.cs_tickets
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- Toda equipe staff pode criar
DROP POLICY IF EXISTS "Staff can create cs tickets" ON public.cs_tickets;
CREATE POLICY "Staff can create cs tickets"
  ON public.cs_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND created_by = auth.uid());

-- Toda equipe staff pode editar
DROP POLICY IF EXISTS "Staff can update cs tickets" ON public.cs_tickets;
CREATE POLICY "Staff can update cs tickets"
  ON public.cs_tickets
  FOR UPDATE
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- Toda equipe staff pode excluir
DROP POLICY IF EXISTS "Staff can delete cs tickets" ON public.cs_tickets;
CREATE POLICY "Staff can delete cs tickets"
  ON public.cs_tickets
  FOR DELETE
  TO authenticated
  USING (public.is_staff(auth.uid()));