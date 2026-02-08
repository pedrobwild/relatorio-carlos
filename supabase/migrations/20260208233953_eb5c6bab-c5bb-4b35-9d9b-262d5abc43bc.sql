-- Fix RLS for locking a formalization when sending for signature
-- Current policy uses a single expression for UPDATE, which is applied both to the old row (USING)
-- and the new row (WITH CHECK default). This blocks setting locked_at during the send-for-signature update.

DROP POLICY IF EXISTS "formalizations_update_policy" ON public.formalizations;

CREATE POLICY "formalizations_update_policy"
ON public.formalizations
FOR UPDATE
USING (
  user_belongs_to_org(auth.uid(), customer_org_id)
  AND (
    user_is_admin(auth.uid())
    OR (
      user_is_staff_or_above(auth.uid())
      AND locked_at IS NULL
    )
    OR (
      created_by = auth.uid()
      AND status = 'draft'::formalization_status
      AND locked_at IS NULL
    )
  )
)
WITH CHECK (
  user_belongs_to_org(auth.uid(), customer_org_id)
  AND (
    user_is_admin(auth.uid())
    OR (
      user_is_staff_or_above(auth.uid())
      AND (
        locked_at IS NULL
        OR (
          status = 'pending_signatures'::formalization_status
          AND locked_hash IS NOT NULL
          AND locked_at IS NOT NULL
        )
      )
    )
    OR (
      created_by = auth.uid()
      AND (
        locked_at IS NULL
        OR (
          status = 'pending_signatures'::formalization_status
          AND locked_hash IS NOT NULL
          AND locked_at IS NOT NULL
        )
      )
    )
  )
);
