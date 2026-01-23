-- Fix RLS policies on public.projects (broken join conditions)

DROP POLICY IF EXISTS "Customers can view their projects" ON public.projects;
CREATE POLICY "Customers can view their projects"
ON public.projects
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.project_customers pc
    WHERE pc.customer_user_id = auth.uid()
      AND pc.project_id = projects.id
  )
);

DROP POLICY IF EXISTS "Staff can view projects they have access to" ON public.projects;
CREATE POLICY "Staff can view projects they have access to"
ON public.projects
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.project_engineers pe
    WHERE pe.engineer_user_id = auth.uid()
      AND pe.project_id = projects.id
  )
);

DROP POLICY IF EXISTS "Staff can update their projects" ON public.projects;
CREATE POLICY "Staff can update their projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.project_engineers pe
    WHERE pe.engineer_user_id = auth.uid()
      AND pe.project_id = projects.id
  )
);
