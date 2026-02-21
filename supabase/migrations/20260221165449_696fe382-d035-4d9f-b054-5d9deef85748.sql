
-- Allow project members to update revision_requested fields on their project's 3D versions
CREATE POLICY "Members can request revision on 3d versions"
  ON public.project_3d_versions
  FOR UPDATE
  USING (has_project_access(auth.uid(), project_id))
  WITH CHECK (has_project_access(auth.uid(), project_id));
