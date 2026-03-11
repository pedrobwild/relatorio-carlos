-- Drop the broken policy and recreate using auth.jwt() instead of auth.users
DROP POLICY IF EXISTS "Customers can view unlinked records by email" ON public.project_customers;

CREATE POLICY "Customers can view unlinked records by email"
ON public.project_customers
FOR SELECT
TO authenticated
USING (
  customer_user_id IS NULL
  AND customer_email = (auth.jwt()->>'email')
);