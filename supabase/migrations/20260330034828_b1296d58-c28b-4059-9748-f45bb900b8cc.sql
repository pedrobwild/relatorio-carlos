-- =============================================
-- Authorship enforcement: WITH CHECK on INSERT + triggers
-- =============================================

-- 1. Non-conformities policies
DROP POLICY IF EXISTS "Staff can manage non conformities" ON public.non_conformities;
DROP POLICY IF EXISTS "Staff can view non conformities" ON public.non_conformities;
DROP POLICY IF EXISTS "Staff can update nc non-status fields" ON public.non_conformities;

CREATE POLICY "Staff can view non conformities"
  ON public.non_conformities FOR SELECT
  TO public
  USING (is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id));

CREATE POLICY "Staff can insert non conformities"
  ON public.non_conformities FOR INSERT
  TO public
  WITH CHECK (
    is_staff(auth.uid())
    AND has_project_access(auth.uid(), project_id)
    AND created_by = auth.uid()
  );

CREATE POLICY "Staff can update nc non-sensitive fields"
  ON public.non_conformities FOR UPDATE
  TO public
  USING (is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id))
  WITH CHECK (is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id));

-- 2. Trigger: force created_by = auth.uid() on non_conformities
CREATE OR REPLACE FUNCTION public.set_created_by()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nc_created_by ON public.non_conformities;
CREATE TRIGGER trg_nc_created_by
  BEFORE INSERT ON public.non_conformities
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

-- 3. Trigger: default inspector_id = auth.uid() on inspections
CREATE OR REPLACE FUNCTION public.set_inspector_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.inspector_id IS NULL THEN
    NEW.inspector_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inspection_inspector_id ON public.inspections;
CREATE TRIGGER trg_inspection_inspector_id
  BEFORE INSERT ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION public.set_inspector_id();

-- 4. Auto updated_at triggers
DROP TRIGGER IF EXISTS trg_inspections_updated_at ON public.inspections;
CREATE TRIGGER trg_inspections_updated_at
  BEFORE UPDATE ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_inspection_items_updated_at ON public.inspection_items;
CREATE TRIGGER trg_inspection_items_updated_at
  BEFORE UPDATE ON public.inspection_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_nc_updated_at ON public.non_conformities;
CREATE TRIGGER trg_nc_updated_at
  BEFORE UPDATE ON public.non_conformities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();