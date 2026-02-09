-- Relax formalization_acknowledgements INSERT policy: allow staff/company signers via project access
-- Fixes RLS false negatives when staff users are not linked to customer org but are allowed to sign as a company party.

DROP POLICY IF EXISTS "formalization_acknowledgements_insert_policy" ON public.formalization_acknowledgements;

CREATE POLICY "formalization_acknowledgements_insert_policy"
ON public.formalization_acknowledgements
FOR INSERT
WITH CHECK (
  acknowledged_by_user_id = auth.uid()

  AND EXISTS (
    SELECT 1
    FROM public.formalizations f
    WHERE f.id = formalization_acknowledgements.formalization_id
      AND f.status = 'pending_signatures'::public.formalization_status
      AND f.locked_hash IS NOT NULL
      AND (
        public.user_belongs_to_org(auth.uid(), f.customer_org_id)
        OR (f.project_id IS NOT NULL AND public.has_project_access(auth.uid(), f.project_id))
      )
  )

  AND EXISTS (
    SELECT 1
    FROM public.formalization_parties p
    WHERE p.id = formalization_acknowledgements.party_id
      AND p.formalization_id = formalization_acknowledgements.formalization_id
      AND (
        p.user_id = auth.uid()
        OR (
          p.email IS NOT NULL
          AND lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
        OR (
          p.party_type = 'company'::public.party_type
          AND public.user_is_staff_or_above(auth.uid())
        )
      )
  )
);
