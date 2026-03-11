-- Allow customers to link their own user_id when email matches
CREATE POLICY "Customers can link own user_id"
  ON public.project_customers
  FOR UPDATE
  TO authenticated
  USING (
    customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND customer_user_id IS NULL
  )
  WITH CHECK (
    customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND customer_user_id = auth.uid()
  );

-- Fix existing unlinked record
UPDATE public.project_customers
SET customer_user_id = '39ebddec-c9f1-43e0-b92d-c1e9acf0e1fb'
WHERE customer_email = 'mmeid@uol.com.br'
  AND customer_user_id IS NULL;