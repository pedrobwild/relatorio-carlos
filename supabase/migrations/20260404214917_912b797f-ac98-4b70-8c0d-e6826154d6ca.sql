
DROP POLICY IF EXISTS "Staff can create projects" ON public.projects;

CREATE POLICY "Staff can create projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('engineer', 'manager', 'admin', 'gestor', 'suprimentos', 'financeiro')
    )
  );
