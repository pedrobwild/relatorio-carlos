
-- Create enum for task status
CREATE TYPE public.obra_task_status AS ENUM ('pendente', 'em_andamento', 'pausado', 'concluido');

-- Create the obra_tasks table
CREATE TABLE public.obra_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  responsible_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date DATE,
  cost NUMERIC(12,2),
  status public.obra_task_status NOT NULL DEFAULT 'pendente',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_obra_tasks_project_id ON public.obra_tasks(project_id);
CREATE INDEX idx_obra_tasks_status ON public.obra_tasks(status);
CREATE INDEX idx_obra_tasks_responsible ON public.obra_tasks(responsible_user_id);

-- Enable RLS
ALTER TABLE public.obra_tasks ENABLE ROW LEVEL SECURITY;

-- RLS: Staff with project access can do everything
CREATE POLICY "Staff can view project tasks"
  ON public.obra_tasks FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), project_id));

CREATE POLICY "Staff can create project tasks"
  ON public.obra_tasks FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), project_id));

CREATE POLICY "Staff can update project tasks"
  ON public.obra_tasks FOR UPDATE
  TO authenticated
  USING (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), project_id));

CREATE POLICY "Staff can delete project tasks"
  ON public.obra_tasks FOR DELETE
  TO authenticated
  USING (public.is_staff(auth.uid()) AND public.has_project_access(auth.uid(), project_id));

-- Auto-update updated_at
CREATE TRIGGER update_obra_tasks_updated_at
  BEFORE UPDATE ON public.obra_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
