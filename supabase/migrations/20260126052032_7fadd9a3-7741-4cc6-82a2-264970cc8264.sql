-- Drop existing policies
DROP POLICY IF EXISTS "Staff can manage payments" ON public.project_payments;

-- Create specific policies: Only admins can update payments (mark as paid)
CREATE POLICY "Admins can update payments"
ON public.project_payments
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- Staff can insert new payments
CREATE POLICY "Staff can insert payments"
ON public.project_payments
FOR INSERT
TO authenticated
WITH CHECK (
  is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id)
);

-- Staff can delete payments
CREATE POLICY "Staff can delete payments"
ON public.project_payments
FOR DELETE
TO authenticated
USING (
  is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id)
);