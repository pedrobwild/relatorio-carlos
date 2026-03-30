-- Bucket para evidências de vistoria/NC
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inspection-evidences',
  'inspection-evidences',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: staff pode fazer upload
CREATE POLICY "Staff can upload inspection evidence"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'inspection-evidences' AND public.is_staff(auth.uid()));

-- RLS: staff pode visualizar
CREATE POLICY "Staff can view inspection evidence"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'inspection-evidences' AND public.is_staff(auth.uid()));

-- RLS: staff pode deletar (para remover fotos)
CREATE POLICY "Staff can delete inspection evidence"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'inspection-evidences' AND public.is_staff(auth.uid()));