
-- Ensure the bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-boletos', 
  'payment-boletos', 
  false, 
  10485760,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view boletos for their projects" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload boletos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update boletos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete boletos" ON storage.objects;

-- Recreate policies using has_role function
CREATE POLICY "Users can view boletos for their projects"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-boletos' AND
  EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.user_id = auth.uid()
    AND pm.project_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Admins can upload boletos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-boletos' AND
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update boletos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'payment-boletos' AND
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete boletos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'payment-boletos' AND
  has_role(auth.uid(), 'admin'::app_role)
);
