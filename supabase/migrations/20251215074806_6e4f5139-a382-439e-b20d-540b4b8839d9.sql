-- Ensure bucket exists (may already exist from previous migration)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'formalization-attachments', 
  'formalization-attachments', 
  false,
  20971520, -- 20MB in bytes
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop existing storage policies if any
DROP POLICY IF EXISTS "Users can view attachments they have access to" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;

-- Storage policy: authenticated users can upload to their org's formalizations
-- Path pattern: formalizations/{formalization_id}/{uuid}-{filename}
CREATE POLICY "formalization_attachments_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'formalization-attachments'
    AND (storage.foldername(name))[1] = 'formalizations'
    AND EXISTS (
      SELECT 1 FROM public.formalizations f
      WHERE f.id::text = (storage.foldername(name))[2]
      AND public.user_belongs_to_org(auth.uid(), f.customer_org_id)
    )
  );

-- Storage policy: users can view attachments from their org
CREATE POLICY "formalization_attachments_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'formalization-attachments'
    AND (storage.foldername(name))[1] = 'formalizations'
    AND EXISTS (
      SELECT 1 FROM public.formalizations f
      WHERE f.id::text = (storage.foldername(name))[2]
      AND public.user_belongs_to_org(auth.uid(), f.customer_org_id)
    )
  );

-- Storage policy: staff+ can delete attachments before lock
CREATE POLICY "formalization_attachments_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'formalization-attachments'
    AND (storage.foldername(name))[1] = 'formalizations'
    AND public.user_is_staff_or_above(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.formalizations f
      WHERE f.id::text = (storage.foldername(name))[2]
      AND public.user_belongs_to_org(auth.uid(), f.customer_org_id)
      AND f.locked_at IS NULL
    )
  );