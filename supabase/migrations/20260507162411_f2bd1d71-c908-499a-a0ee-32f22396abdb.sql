DROP POLICY IF EXISTS "Authenticated users can view project info docs" ON public.project_info_docs;
DROP POLICY IF EXISTS "Authenticated users can update project info docs" ON public.project_info_docs;
DROP POLICY IF EXISTS "Authenticated users can insert project info docs" ON public.project_info_docs;

CREATE POLICY "Users with project access can view project info docs"
  ON public.project_info_docs FOR SELECT
  USING (public.has_project_access(auth.uid(), project_id));

CREATE POLICY "Users with project access can insert project info docs"
  ON public.project_info_docs FOR INSERT
  WITH CHECK (public.has_project_access(auth.uid(), project_id));

CREATE POLICY "Users with project access can update project info docs"
  ON public.project_info_docs FOR UPDATE
  USING (public.has_project_access(auth.uid(), project_id))
  WITH CHECK (public.has_project_access(auth.uid(), project_id));

CREATE POLICY "Staff can delete project info docs"
  ON public.project_info_docs FOR DELETE
  USING (public.is_staff(auth.uid()));