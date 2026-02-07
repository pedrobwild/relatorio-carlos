
-- Fix is_staff function to include 'manager' role
-- BUG: Managers were excluded from staff checks, breaking their access
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('engineer', 'manager', 'admin')
  )
$$;

-- Fix project_payments UPDATE policy
-- BUG: Only admins could update payments, but engineers/managers need this too
DROP POLICY IF EXISTS "Admins can update payments" ON public.project_payments;

CREATE POLICY "Staff can update payments"
ON public.project_payments
FOR UPDATE
TO authenticated
USING (
  public.is_staff(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR EXISTS (
          SELECT 1 FROM public.project_engineers pe
          WHERE pe.project_id = p.id AND pe.engineer_user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid() AND pm.role IN ('owner', 'engineer')
        )
      )
  )
);
