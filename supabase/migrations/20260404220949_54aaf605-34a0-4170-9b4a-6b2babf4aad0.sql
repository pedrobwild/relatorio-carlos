
CREATE TABLE public.obra_task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.obra_tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_obra_task_comments_task_id ON public.obra_task_comments(task_id);
CREATE INDEX idx_obra_task_comments_author_id ON public.obra_task_comments(author_id);

ALTER TABLE public.obra_task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view task comments"
  ON public.obra_task_comments FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can create task comments"
  ON public.obra_task_comments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND author_id = auth.uid());

CREATE POLICY "Authors can delete own comments"
  ON public.obra_task_comments FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());
