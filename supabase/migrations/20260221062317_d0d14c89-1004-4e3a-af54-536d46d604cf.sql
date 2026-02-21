-- Add DELETE policy for project-documents storage bucket
CREATE POLICY "Staff can delete project documents"
ON storage.objects
FOR DELETE
USING (bucket_id = 'project-documents' AND is_staff(auth.uid()));