
-- Drop the old customer policy on projects
DROP POLICY IF EXISTS "Customers can view their projects" ON public.projects;

-- Create new policy that checks both project_members and legacy project_customers tables
CREATE POLICY "Customers can view their projects" ON public.projects
  FOR SELECT
  USING (
    -- Check unified project_members table
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.user_id = auth.uid() AND pm.project_id = projects.id
    )
    OR
    -- Backwards compatibility with legacy project_customers table
    EXISTS (
      SELECT 1 FROM public.project_customers pc
      WHERE pc.customer_user_id = auth.uid() AND pc.project_id = projects.id
    )
  );
