-- Fix RLS on project_templates: replace profiles.role-based policy with user_roles-based
DROP POLICY IF EXISTS "Admins can do everything on templates" ON public.project_templates;

CREATE POLICY "Staff can manage templates"
  ON public.project_templates
  FOR ALL
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));
