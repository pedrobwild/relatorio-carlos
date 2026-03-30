
-- =============================================
-- Fix RLS: Restrict inspections module to staff only
-- Previously: has_project_access allowed customers to see data
-- Now: is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id)
-- =============================================

-- 1. Inspections SELECT
DROP POLICY IF EXISTS "Users with project access can view inspections" ON public.inspections;
CREATE POLICY "Staff can view inspections"
  ON public.inspections FOR SELECT
  TO public
  USING (is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id));

-- 2. Non-conformities SELECT
DROP POLICY IF EXISTS "Users with project access can view non conformities" ON public.non_conformities;
CREATE POLICY "Staff can view non conformities"
  ON public.non_conformities FOR SELECT
  TO public
  USING (is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id));

-- 3. Inspection items SELECT (via JOIN to parent)
DROP POLICY IF EXISTS "Users can view inspection items" ON public.inspection_items;
CREATE POLICY "Staff can view inspection items"
  ON public.inspection_items FOR SELECT
  TO public
  USING (EXISTS (
    SELECT 1 FROM public.inspections i
    WHERE i.id = inspection_items.inspection_id
      AND is_staff(auth.uid())
      AND has_project_access(auth.uid(), i.project_id)
  ));

-- 4. NC History SELECT (via JOIN to parent)
DROP POLICY IF EXISTS "Users can view nc history" ON public.nc_history;
CREATE POLICY "Staff can view nc history"
  ON public.nc_history FOR SELECT
  TO public
  USING (EXISTS (
    SELECT 1 FROM public.non_conformities nc
    WHERE nc.id = nc_history.nc_id
      AND is_staff(auth.uid())
      AND has_project_access(auth.uid(), nc.project_id)
  ));
