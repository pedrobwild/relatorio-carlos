-- Drop existing policies
DROP POLICY IF EXISTS "weekly_reports_select" ON public.weekly_reports;
DROP POLICY IF EXISTS "weekly_reports_insert" ON public.weekly_reports;
DROP POLICY IF EXISTS "weekly_reports_update" ON public.weekly_reports;
DROP POLICY IF EXISTS "weekly_reports_delete" ON public.weekly_reports;

-- Recreate with CORRECT argument order: has_project_access(user_id, project_id)

-- SELECT: Staff can see all, customers only after available_at
CREATE POLICY "weekly_reports_select" ON public.weekly_reports
FOR SELECT USING (
  has_project_access(auth.uid(), project_id) 
  AND (
    is_staff(auth.uid()) 
    OR user_is_staff_or_above(auth.uid())
    OR (available_at IS NOT NULL AND available_at <= now())
  )
);

-- INSERT: Staff/managers only
CREATE POLICY "weekly_reports_insert" ON public.weekly_reports
FOR INSERT WITH CHECK (
  is_staff(auth.uid()) 
  OR user_is_staff_or_above(auth.uid())
  OR has_role(auth.uid(), 'admin')
);

-- UPDATE: Staff/managers only
CREATE POLICY "weekly_reports_update" ON public.weekly_reports
FOR UPDATE USING (
  has_project_access(auth.uid(), project_id)
  AND (
    is_staff(auth.uid()) 
    OR user_is_staff_or_above(auth.uid())
    OR has_role(auth.uid(), 'admin')
  )
) WITH CHECK (
  has_project_access(auth.uid(), project_id)
  AND (
    is_staff(auth.uid()) 
    OR user_is_staff_or_above(auth.uid())
    OR has_role(auth.uid(), 'admin')
  )
);

-- DELETE: Admins only
CREATE POLICY "weekly_reports_delete" ON public.weekly_reports
FOR DELETE USING (
  has_project_access(auth.uid(), project_id)
  AND has_role(auth.uid(), 'admin')
);