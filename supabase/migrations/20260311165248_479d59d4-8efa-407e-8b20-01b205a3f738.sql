-- Allow customers to SELECT their own unlinked records by email match
-- This is needed so the auto-link hook can find records to update on first login
CREATE POLICY "Customers can view unlinked records by email"
ON public.project_customers
FOR SELECT
TO authenticated
USING (
  customer_user_id IS NULL
  AND customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);