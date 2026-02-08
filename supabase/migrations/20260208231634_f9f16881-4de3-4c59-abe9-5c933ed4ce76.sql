
-- Update delete policy for formalizations
-- Admins can delete any formalization that is NOT fully signed (status != 'signed')
DROP POLICY IF EXISTS formalizations_delete_policy ON public.formalizations;

CREATE POLICY "formalizations_delete_policy" ON public.formalizations
FOR DELETE
USING (
  -- Admin from the same org
  has_role(auth.uid(), 'admin')
  AND user_belongs_to_org(auth.uid(), customer_org_id)
  -- Can delete if NOT fully signed (draft, pending_signatures, or voided)
  AND status != 'signed'
);
