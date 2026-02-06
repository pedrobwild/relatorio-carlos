-- Update RLS policy for weekly-reports bucket to match new path format
-- Path format: {userId}/{projectId}/week-{weekNumber}/{photoId}-{timestamp}.{ext}

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can upload to weekly-reports" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update weekly-reports files" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete weekly-reports files" ON storage.objects;

-- Recreate INSERT policy: user can upload if first path segment is their user ID
CREATE POLICY "Users can upload to weekly-reports"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'weekly-reports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Recreate UPDATE policy: user can update their own files
CREATE POLICY "Users can update weekly-reports files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'weekly-reports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Recreate DELETE policy: user can delete their own files
CREATE POLICY "Users can delete weekly-reports files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'weekly-reports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);