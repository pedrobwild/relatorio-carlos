
-- Add completion tracking columns to obra_tasks
ALTER TABLE public.obra_tasks
  ADD COLUMN completed_at TIMESTAMPTZ,
  ADD COLUMN days_overdue INTEGER;

-- Create status history table
CREATE TABLE public.obra_task_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.obra_tasks(id) ON DELETE CASCADE,
  old_status public.obra_task_status,
  new_status public.obra_task_status NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_obra_task_status_history_task ON public.obra_task_status_history(task_id);

ALTER TABLE public.obra_task_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view status history"
  ON public.obra_task_status_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.obra_tasks ot
      WHERE ot.id = task_id
        AND public.has_obra_access(ot.project_id)
    )
  );

CREATE POLICY "Staff can insert status history"
  ON public.obra_task_status_history FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.obra_tasks ot
      WHERE ot.id = task_id
        AND public.has_obra_access(ot.project_id)
    )
  );

-- Trigger to auto-fill completed_at and days_overdue
CREATE OR REPLACE FUNCTION public.obra_task_on_status_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
BEGIN
  -- Only act on actual status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Record history
    INSERT INTO public.obra_task_status_history (task_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());

    -- When moving to concluido
    IF NEW.status = 'concluido' THEN
      NEW.completed_at := now();
      IF NEW.due_date IS NOT NULL THEN
        NEW.days_overdue := (CURRENT_DATE - NEW.due_date);
      ELSE
        NEW.days_overdue := NULL;
      END IF;
    END IF;

    -- When moving away from concluido, clear completion fields
    IF OLD.status = 'concluido' AND NEW.status != 'concluido' THEN
      NEW.completed_at := NULL;
      NEW.days_overdue := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_obra_task_status_change
  BEFORE UPDATE ON public.obra_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.obra_task_on_status_change();
