
-- Fix staff projects SELECT policy to include project_members
-- BUG: Staff could only see projects where they were in project_engineers,
-- but the new flow adds them primarily to project_members

DROP POLICY IF EXISTS "Staff can view projects they have access to" ON public.projects;

CREATE POLICY "Staff can view projects they have access to"
ON public.projects
FOR SELECT
TO authenticated
USING (
  -- Admins see everything
  public.has_role(auth.uid(), 'admin')
  -- Staff in project_engineers (legacy)
  OR EXISTS (
    SELECT 1 FROM public.project_engineers pe
    WHERE pe.engineer_user_id = auth.uid() 
      AND pe.project_id = projects.id
  )
  -- Staff in project_members (new system)
  OR (
    public.is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.user_id = auth.uid() 
        AND pm.project_id = projects.id
    )
  )
);

-- Also fix projects UPDATE policy to include project_members
DROP POLICY IF EXISTS "Staff can update their projects" ON public.projects;

CREATE POLICY "Staff can update their projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (
  -- Admins can update any project
  public.has_role(auth.uid(), 'admin')
  -- Staff in project_engineers (legacy)
  OR EXISTS (
    SELECT 1 FROM public.project_engineers pe
    WHERE pe.engineer_user_id = auth.uid() 
      AND pe.project_id = projects.id
  )
  -- Staff in project_members with owner/engineer role
  OR EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.user_id = auth.uid() 
      AND pm.project_id = projects.id
      AND pm.role IN ('owner', 'engineer')
  )
);
