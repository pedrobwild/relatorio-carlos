-- Create storage bucket for weekly report photos/videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'weekly-reports', 
  'weekly-reports', 
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload to weekly-reports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'weekly-reports');

-- Policy: Allow public viewing
CREATE POLICY "Public can view weekly-reports files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'weekly-reports');

-- Policy: Allow owners to update/delete
CREATE POLICY "Owners can update weekly-reports files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'weekly-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can delete weekly-reports files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'weekly-reports' AND auth.uid()::text = (storage.foldername(name))[1]);