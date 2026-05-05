-- 1) Make weekly-reports bucket private
UPDATE storage.buckets SET public = false WHERE id = 'weekly-reports';

-- 2) Restrict invitations SELECT: only inviting staff or admin can read tokens
DROP POLICY IF EXISTS "Staff can view invitations" ON public.invitations;
CREATE POLICY "Inviter or admin can view invitations"
ON public.invitations
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR invited_by = auth.uid()
);

-- 3) Tighten domain_events SELECT: require explicit project membership (or admin)
DROP POLICY IF EXISTS "Users can view events from their projects" ON public.domain_events;
CREATE POLICY "Users can view events from their projects"
ON public.domain_events
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (project_id IS NOT NULL AND is_project_member(auth.uid(), project_id))
);
