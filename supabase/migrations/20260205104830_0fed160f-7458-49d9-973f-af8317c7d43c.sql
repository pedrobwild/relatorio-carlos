-- Update RLS policy for journey_csm to include project_customers
DROP POLICY IF EXISTS "Users can view journey_csm for their projects" ON journey_csm;

CREATE POLICY "Users can view journey_csm for their projects"
ON journey_csm FOR SELECT
USING (
  -- Staff can view all
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.role IN ('admin', 'manager', 'engineer')
  )
  OR
  -- Project members can view
  EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = journey_csm.project_id
    AND pm.user_id = auth.uid()
  )
  OR
  -- Project customers can view
  EXISTS (
    SELECT 1 FROM project_customers pc
    WHERE pc.project_id = journey_csm.project_id
    AND pc.customer_user_id = auth.uid()
  )
);