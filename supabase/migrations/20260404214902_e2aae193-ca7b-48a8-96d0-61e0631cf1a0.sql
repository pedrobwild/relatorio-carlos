
-- Drop and recreate the INSERT policy for projects with clearer logic
DROP POLICY IF EXISTS "Staff can create projects" ON public.projects;

CREATE POLICY "Staff can create projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (
    is_staff(auth.uid()) 
    AND created_by = auth.uid()
  );
