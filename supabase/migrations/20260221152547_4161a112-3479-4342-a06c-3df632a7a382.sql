
CREATE TABLE public.project_page_instructions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  page_key text NOT NULL,
  content_html text NOT NULL DEFAULT '',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, page_key)
);

ALTER TABLE public.project_page_instructions ENABLE ROW LEVEL SECURITY;

-- Staff can manage instructions
CREATE POLICY "Staff can manage page instructions"
ON public.project_page_instructions
FOR ALL
USING (is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id));

-- All project members can view
CREATE POLICY "Users can view page instructions"
ON public.project_page_instructions
FOR SELECT
USING (has_project_access(auth.uid(), project_id));
