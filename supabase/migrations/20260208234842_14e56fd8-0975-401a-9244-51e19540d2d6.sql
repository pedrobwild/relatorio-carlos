
-- Fix RLS policy for formalization_acknowledgements INSERT
-- Bug: p.formalization_id = p.formalization_id should be p.formalization_id = formalization_acknowledgements.formalization_id

DROP POLICY IF EXISTS "formalization_acknowledgements_insert_policy" ON public.formalization_acknowledgements;

CREATE POLICY "formalization_acknowledgements_insert_policy"
ON public.formalization_acknowledgements
FOR INSERT
WITH CHECK (
  -- User must be the one acknowledging
  acknowledged_by_user_id = auth.uid()
  -- Formalization must be in pending_signatures status and locked
  AND EXISTS (
    SELECT 1 FROM formalizations f
    WHERE f.id = formalization_acknowledgements.formalization_id
      AND user_belongs_to_org(auth.uid(), f.customer_org_id)
      AND f.status = 'pending_signatures'::formalization_status
      AND f.locked_hash IS NOT NULL
  )
  -- User must be linked to the party they're signing for
  AND EXISTS (
    SELECT 1 FROM formalization_parties p
    WHERE p.id = formalization_acknowledgements.party_id
      AND p.formalization_id = formalization_acknowledgements.formalization_id  -- FIXED: was p.formalization_id = p.formalization_id
      AND (
        -- Customer party: must match user_id or email
        (
          p.party_type = 'customer'::party_type
          AND (
            p.user_id = auth.uid()
            OR p.email = (SELECT profiles.email FROM profiles WHERE profiles.user_id = auth.uid())
          )
        )
        -- Company party: must be staff or above
        OR (
          p.party_type = 'company'::party_type
          AND user_is_staff_or_above(auth.uid())
        )
      )
  )
);
