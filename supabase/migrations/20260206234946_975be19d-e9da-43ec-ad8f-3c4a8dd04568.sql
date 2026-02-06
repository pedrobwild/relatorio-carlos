-- Fix project_members INSERT policy to allow initial member creation
-- Current issue: can_manage_project checks project_members, but we need to insert first member

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Project managers can manage members" ON public.project_members;

-- Create new INSERT policy that allows:
-- 1. Admins (always)
-- 2. Staff users who created the project (for initial setup)
-- 3. Users who already have management permissions via existing membership
CREATE POLICY "Staff can add initial member or managers can add members"
ON public.project_members
FOR INSERT
TO authenticated
WITH CHECK (
  -- Admins can always add members
  public.has_role(auth.uid(), 'admin')
  -- Staff can add themselves as initial member to projects they created
  OR (
    public.is_staff(auth.uid())
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = project_id AND p.created_by = auth.uid()
    )
  )
  -- Existing managers can add other members
  OR public.can_manage_project(auth.uid(), project_id)
);