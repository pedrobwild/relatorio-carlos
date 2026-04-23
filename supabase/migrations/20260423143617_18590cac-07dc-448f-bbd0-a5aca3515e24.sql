-- Tabela de histórico de tickets de CS
CREATE TABLE IF NOT EXISTS public.cs_ticket_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.cs_tickets(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL, -- 'created' | 'status_changed' | 'severity_changed' | 'responsible_changed' | 'action_plan_changed' | 'situation_changed' | 'description_changed' | 'comment'
  old_value text,
  new_value text,
  notes text, -- comentário livre opcional
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cs_ticket_history_ticket ON public.cs_ticket_history(ticket_id, created_at DESC);

ALTER TABLE public.cs_ticket_history ENABLE ROW LEVEL SECURITY;

-- Staff pode ver tudo
CREATE POLICY "Staff can view cs ticket history"
ON public.cs_ticket_history
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

-- Staff pode inserir comentários
CREATE POLICY "Staff can insert cs ticket history"
ON public.cs_ticket_history
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

-- Função que registra mudanças automaticamente
CREATE OR REPLACE FUNCTION public.log_cs_ticket_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.cs_ticket_history (ticket_id, actor_id, event_type, new_value)
    VALUES (NEW.id, COALESCE(v_actor, NEW.created_by), 'created', NEW.status::text);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.cs_ticket_history (ticket_id, actor_id, event_type, old_value, new_value)
      VALUES (NEW.id, v_actor, 'status_changed', OLD.status::text, NEW.status::text);
    END IF;
    IF OLD.severity IS DISTINCT FROM NEW.severity THEN
      INSERT INTO public.cs_ticket_history (ticket_id, actor_id, event_type, old_value, new_value)
      VALUES (NEW.id, v_actor, 'severity_changed', OLD.severity::text, NEW.severity::text);
    END IF;
    IF OLD.responsible_user_id IS DISTINCT FROM NEW.responsible_user_id THEN
      INSERT INTO public.cs_ticket_history (ticket_id, actor_id, event_type, old_value, new_value)
      VALUES (NEW.id, v_actor, 'responsible_changed',
              COALESCE(OLD.responsible_user_id::text, ''),
              COALESCE(NEW.responsible_user_id::text, ''));
    END IF;
    IF COALESCE(OLD.action_plan,'') IS DISTINCT FROM COALESCE(NEW.action_plan,'') THEN
      INSERT INTO public.cs_ticket_history (ticket_id, actor_id, event_type, old_value, new_value)
      VALUES (NEW.id, v_actor, 'action_plan_changed', OLD.action_plan, NEW.action_plan);
    END IF;
    IF OLD.situation IS DISTINCT FROM NEW.situation THEN
      INSERT INTO public.cs_ticket_history (ticket_id, actor_id, event_type, old_value, new_value)
      VALUES (NEW.id, v_actor, 'situation_changed', OLD.situation, NEW.situation);
    END IF;
    IF COALESCE(OLD.description,'') IS DISTINCT FROM COALESCE(NEW.description,'') THEN
      INSERT INTO public.cs_ticket_history (ticket_id, actor_id, event_type, old_value, new_value)
      VALUES (NEW.id, v_actor, 'description_changed', OLD.description, NEW.description);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cs_ticket_history ON public.cs_tickets;
CREATE TRIGGER trg_cs_ticket_history
AFTER INSERT OR UPDATE ON public.cs_tickets
FOR EACH ROW EXECUTE FUNCTION public.log_cs_ticket_changes();