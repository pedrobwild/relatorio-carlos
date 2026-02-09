-- Fix RLS INSERT policy to allow designated company signers by matching party email
-- This prevents false negatives when a "company" party user has role=customer but is explicitly listed as a signer.

DROP POLICY IF EXISTS "formalization_acknowledgements_insert_policy" ON public.formalization_acknowledgements;

CREATE POLICY "formalization_acknowledgements_insert_policy"
ON public.formalization_acknowledgements
FOR INSERT
WITH CHECK (
  -- The logged-in user must be the one recorded in the acknowledgement
  acknowledged_by_user_id = auth.uid()

  -- Formalization must be in pending_signatures and locked
  AND EXISTS (
    SELECT 1
    FROM public.formalizations f
    WHERE f.id = formalization_acknowledgements.formalization_id
      AND user_belongs_to_org(auth.uid(), f.customer_org_id)
      AND f.status = 'pending_signatures'::public.formalization_status
      AND f.locked_hash IS NOT NULL
  )

  -- The user must be the party they're acknowledging for (by user_id or email),
  -- OR be staff (fallback for internal flows without email binding)
  AND EXISTS (
    SELECT 1
    FROM public.formalization_parties p
    WHERE p.id = formalization_acknowledgements.party_id
      AND p.formalization_id = formalization_acknowledgements.formalization_id
      AND (
        p.user_id = auth.uid()
        OR (p.email IS NOT NULL AND p.email = (auth.jwt() ->> 'email'))
        OR (p.party_type = 'company'::public.party_type AND public.user_is_staff_or_above(auth.uid()))
      )
  )
);