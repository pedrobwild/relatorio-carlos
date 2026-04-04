-- Add missing UPDATE policy for inspection-evidences bucket
CREATE POLICY "Staff can update inspection evidence"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'inspection-evidences'
  AND is_staff(auth.uid())
);

-- Drop old ambiguous overload of transition_nc_status (the one with p_evidence_photo_paths)
DROP FUNCTION IF EXISTS public.transition_nc_status(uuid, nc_status, text, text, text, text, text[]);