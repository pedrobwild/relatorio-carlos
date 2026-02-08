
-- Fix the user_is_staff_or_above function to check user_roles table instead of profiles
-- This aligns with the architecture standard where roles are in user_roles table
CREATE OR REPLACE FUNCTION public.user_is_staff_or_above(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role IN ('engineer', 'manager', 'admin')
  )
$$;

-- Also ensure that customers can create draft formalizations
-- The current policy is correct but let's make sure it works for customers too
-- by updating the INSERT policy to be more explicit

DROP POLICY IF EXISTS formalizations_insert_policy ON public.formalizations;

CREATE POLICY "formalizations_insert_policy" ON public.formalizations
FOR INSERT
WITH CHECK (
  -- User must be the creator
  created_by = auth.uid()
  AND
  -- Customer org must match user's org
  customer_org_id = get_user_org_id(auth.uid())
  AND
  (
    -- Staff can create any status
    public.is_staff(auth.uid())
    OR
    -- Non-staff can only create drafts
    status = 'draft'
  )
);
