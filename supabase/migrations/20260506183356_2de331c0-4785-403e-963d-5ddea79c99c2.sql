-- Drop old policies tied to userId-as-first-segment
DROP POLICY IF EXISTS "Users can upload to weekly-reports" ON storage.objects;
DROP POLICY IF EXISTS "Users can update weekly-reports files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete weekly-reports files" ON storage.objects;
DROP POLICY IF EXISTS "Project members can view weekly reports" ON storage.objects;

-- New consistent policies: first segment = project_id
CREATE POLICY "Weekly reports: project members can view"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'weekly-reports'
  AND (
    is_staff(auth.uid())
    OR (
      (storage.foldername(name))[1] IS NOT NULL
      AND has_project_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  )
);

CREATE POLICY "Weekly reports: project members can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'weekly-reports'
  AND (
    is_staff(auth.uid())
    OR (
      (storage.foldername(name))[1] IS NOT NULL
      AND has_project_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  )
);

CREATE POLICY "Weekly reports: project members can update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'weekly-reports'
  AND (
    is_staff(auth.uid())
    OR (
      (storage.foldername(name))[1] IS NOT NULL
      AND has_project_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  )
);

CREATE POLICY "Weekly reports: staff can delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'weekly-reports'
  AND is_staff(auth.uid())
);
