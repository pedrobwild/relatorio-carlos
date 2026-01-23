-- Tighten overly permissive RLS policy flagged by linter

DROP POLICY IF EXISTS "System can insert errors" ON public.system_errors;
CREATE POLICY "System can insert errors"
ON public.system_errors
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (org_id IS NULL OR org_id = get_user_org_id(auth.uid()))
);
