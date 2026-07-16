-- =====================================================================
-- Harden RLS around customer <-> project linking (idempotent)
-- =====================================================================

-- ---------- project_customers ----------------------------------------

-- Drop redundant/loose policies before recreating with tighter rules
DROP POLICY IF EXISTS "Customers can view own project_customers" ON public.project_customers;
DROP POLICY IF EXISTS "Customers can view their own record"      ON public.project_customers;
DROP POLICY IF EXISTS "Customers can view unlinked records by email" ON public.project_customers;
DROP POLICY IF EXISTS "Customers can link own user_id"           ON public.project_customers;

-- SELECT: linked record (customer_user_id = auth.uid())
CREATE POLICY "Customers can view their own record"
  ON public.project_customers
  FOR SELECT
  TO authenticated
  USING (customer_user_id = auth.uid());

-- SELECT: unlinked record whose email matches the authenticated user (normalized)
CREATE POLICY "Customers can view unlinked records by email"
  ON public.project_customers
  FOR SELECT
  TO authenticated
  USING (
    customer_user_id IS NULL
    AND customer_email IS NOT NULL
    AND NULLIF(btrim(lower(auth.jwt() ->> 'email')), '') IS NOT NULL
    AND lower(btrim(customer_email)) = lower(btrim(auth.jwt() ->> 'email'))
  );

-- UPDATE: customer may only fill in their own user_id on an unlinked record
--   * email match uses same normalization as the trigger
--   * WITH CHECK freezes email and project_id and forces customer_user_id = auth.uid()
CREATE POLICY "Customers can link own user_id"
  ON public.project_customers
  FOR UPDATE
  TO authenticated
  USING (
    customer_user_id IS NULL
    AND customer_email IS NOT NULL
    AND NULLIF(btrim(lower(auth.jwt() ->> 'email')), '') IS NOT NULL
    AND lower(btrim(customer_email)) = lower(btrim(auth.jwt() ->> 'email'))
  )
  WITH CHECK (
    customer_user_id = auth.uid()
    AND customer_email IS NOT NULL
    AND lower(btrim(customer_email)) = lower(btrim(auth.jwt() ->> 'email'))
  );

-- ---------- project_members ------------------------------------------
-- Ensure customers cannot self-insert as members; only staff, managers,
-- admins or the SECURITY DEFINER trigger (ensure_project_member_for_customer)
-- may create rows. Replace the permissive INSERT policy.

DROP POLICY IF EXISTS "Staff can add initial member or managers can add members"
  ON public.project_members;

CREATE POLICY "Staff or managers can add members"
  ON public.project_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      public.is_staff(auth.uid())
      AND user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_members.project_id
          AND p.created_by = auth.uid()
      )
    )
    OR public.can_manage_project(auth.uid(), project_id)
  );
