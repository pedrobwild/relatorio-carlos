-- Add priority and start_date to obra_tasks
ALTER TABLE public.obra_tasks 
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS start_date date;

-- Create subtasks table
CREATE TABLE public.obra_task_subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.obra_tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  completed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_obra_task_subtasks_task_id ON public.obra_task_subtasks(task_id);

-- Enable RLS
ALTER TABLE public.obra_task_subtasks ENABLE ROW LEVEL SECURITY;

-- RLS policies: staff can manage subtasks for projects they have access to
CREATE POLICY "Staff can view subtasks" ON public.obra_task_subtasks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.obra_tasks ot
      WHERE ot.id = task_id
      AND public.has_obra_access(ot.project_id)
    )
  );

CREATE POLICY "Staff can insert subtasks" ON public.obra_task_subtasks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.obra_tasks ot
      WHERE ot.id = task_id
      AND public.has_obra_access(ot.project_id)
    )
    AND public.is_staff(auth.uid())
  );

CREATE POLICY "Staff can update subtasks" ON public.obra_task_subtasks
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.obra_tasks ot
      WHERE ot.id = task_id
      AND public.has_obra_access(ot.project_id)
    )
    AND public.is_staff(auth.uid())
  );

CREATE POLICY "Staff can delete subtasks" ON public.obra_task_subtasks
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.obra_tasks ot
      WHERE ot.id = task_id
      AND public.has_obra_access(ot.project_id)
    )
    AND public.is_staff(auth.uid())
  );

-- Trigger to auto-update updated_at
CREATE TRIGGER update_obra_task_subtasks_updated_at
  BEFORE UPDATE ON public.obra_task_subtasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to set completed_at when completed changes
CREATE OR REPLACE FUNCTION public.obra_subtask_on_complete()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NEW.completed AND NOT OLD.completed THEN
    NEW.completed_at := now();
    NEW.completed_by := auth.uid();
  ELSIF NOT NEW.completed AND OLD.completed THEN
    NEW.completed_at := NULL;
    NEW.completed_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER obra_subtask_complete_trigger
  BEFORE UPDATE ON public.obra_task_subtasks
  FOR EACH ROW
  EXECUTE FUNCTION public.obra_subtask_on_complete();