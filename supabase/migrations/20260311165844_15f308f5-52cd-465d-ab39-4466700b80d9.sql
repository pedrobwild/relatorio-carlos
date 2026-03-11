-- Fix the UPDATE policy that references auth.users directly
DROP POLICY IF EXISTS "Customers can link own user_id" ON public.project_customers;

CREATE POLICY "Customers can link own user_id"
ON public.project_customers
FOR UPDATE
TO authenticated
USING (
  customer_email = (auth.jwt()->>'email')
  AND customer_user_id IS NULL
)
WITH CHECK (
  customer_email = (auth.jwt()->>'email')
  AND customer_user_id = auth.uid()
);