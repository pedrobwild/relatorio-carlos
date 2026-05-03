
-- 1. Scope staff access to project_customers by project membership
DROP POLICY IF EXISTS "Staff can manage project customers" ON public.project_customers;
DROP POLICY IF EXISTS "Staff can view all project_customers" ON public.project_customers;

CREATE POLICY "Staff can view assigned project_customers"
ON public.project_customers
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id))
);

CREATE POLICY "Staff can insert assigned project_customers"
ON public.project_customers
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id))
);

CREATE POLICY "Staff can update assigned project_customers"
ON public.project_customers
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id))
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id))
);

CREATE POLICY "Staff can delete assigned project_customers"
ON public.project_customers
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id))
);

-- 2. Restrict realtime.messages so users can only subscribe when authenticated.
-- Underlying table RLS still gates which row payloads they actually receive.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can receive realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated users can receive realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);
