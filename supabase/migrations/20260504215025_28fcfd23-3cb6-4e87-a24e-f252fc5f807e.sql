
-- Add photo path to stock movements
ALTER TABLE public.stock_movements 
  ADD COLUMN IF NOT EXISTS photo_path text;

-- Create storage bucket for stock movement photos (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('stock-photos', 'stock-photos', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for stock-photos bucket: staff only
DROP POLICY IF EXISTS "Staff can view stock photos" ON storage.objects;
CREATE POLICY "Staff can view stock photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'stock-photos' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can upload stock photos" ON storage.objects;
CREATE POLICY "Staff can upload stock photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'stock-photos' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can update stock photos" ON storage.objects;
CREATE POLICY "Staff can update stock photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'stock-photos' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can delete stock photos" ON storage.objects;
CREATE POLICY "Staff can delete stock photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'stock-photos' AND public.is_staff(auth.uid()));
