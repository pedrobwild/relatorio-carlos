
CREATE TABLE public.project_info_docs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  content_html TEXT NOT NULL DEFAULT '',
  last_edited_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id)
);

ALTER TABLE public.project_info_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view project info docs"
  ON public.project_info_docs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_info_docs.project_id
        AND p.org_id = public.get_user_org_id(auth.uid())
    )
  );

CREATE POLICY "Authenticated users can insert project info docs"
  ON public.project_info_docs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_info_docs.project_id
        AND p.org_id = public.get_user_org_id(auth.uid())
    )
  );

CREATE POLICY "Authenticated users can update project info docs"
  ON public.project_info_docs FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_info_docs.project_id
        AND p.org_id = public.get_user_org_id(auth.uid())
    )
  );

CREATE TRIGGER update_project_info_docs_updated_at
  BEFORE UPDATE ON public.project_info_docs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
