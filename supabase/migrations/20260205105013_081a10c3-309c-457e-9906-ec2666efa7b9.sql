-- Update RLS policy for journey_csm to use user_roles table instead of profiles
DROP POLICY IF EXISTS "Users can view journey_csm for their projects" ON journey_csm;
DROP POLICY IF EXISTS "Admins can manage journey_csm" ON journey_csm;

-- Policy for staff to manage (using user_roles)
CREATE POLICY "Admins can manage journey_csm"
ON journey_csm FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'engineer'::app_role)
);

-- Policy for viewing (using user_roles and project access)
CREATE POLICY "Users can view journey_csm for their projects"
ON journey_csm FOR SELECT
USING (
  -- Staff can view all
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'engineer'::app_role) OR
  -- Project members can view
  EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = journey_csm.project_id
    AND pm.user_id = auth.uid()
  ) OR
  -- Project customers can view
  EXISTS (
    SELECT 1 FROM project_customers pc
    WHERE pc.project_id = journey_csm.project_id
    AND pc.customer_user_id = auth.uid()
  )
);