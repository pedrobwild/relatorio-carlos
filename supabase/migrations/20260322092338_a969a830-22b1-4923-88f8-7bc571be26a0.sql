
-- Create storage bucket for stage photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('stage-photos', 'stage-photos', false, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload stage photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'stage-photos');

CREATE POLICY "Authenticated users can view stage photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'stage-photos');

CREATE POLICY "Users can delete own stage photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'stage-photos');
