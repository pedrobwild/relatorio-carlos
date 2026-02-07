-- Fix 1: Restrict auditoria INSERT policy to only allow inserts 
-- where the user is involved in the related obra or is an admin
-- The current policy allows any authenticated user to insert any audit record

-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "system_insert_auditoria" ON public.auditoria;

-- Create a more restrictive INSERT policy
-- Allow inserts only when:
-- 1. User is an admin, OR
-- 2. User has access to the related obra
CREATE POLICY "auditoria_insert_validated" ON public.auditoria
  FOR INSERT 
  WITH CHECK (
    has_role(auth.uid(), 'admin') 
    OR (
      obra_id IS NOT NULL 
      AND has_obra_access(obra_id)
    )
    OR (
      obra_id IS NULL 
      AND por_user_id = auth.uid()
    )
  );