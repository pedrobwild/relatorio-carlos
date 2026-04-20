
-- Create table for project 3D photos gallery
CREATE TABLE public.project_3d_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  storage_path text NOT NULL,
  caption text DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_3d_photos_project ON public.project_3d_photos(project_id, sort_order);

ALTER TABLE public.project_3d_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view 3D photos"
  ON public.project_3d_photos FOR SELECT TO authenticated
  USING (has_project_access(auth.uid(), project_id));

CREATE POLICY "Project members can insert 3D photos"
  ON public.project_3d_photos FOR INSERT TO authenticated
  WITH CHECK (has_project_access(auth.uid(), project_id) AND uploaded_by = auth.uid());

CREATE POLICY "Project members can update 3D photos"
  ON public.project_3d_photos FOR UPDATE TO authenticated
  USING (has_project_access(auth.uid(), project_id));

CREATE POLICY "Project members can delete 3D photos"
  ON public.project_3d_photos FOR DELETE TO authenticated
  USING (has_project_access(auth.uid(), project_id));

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('project-3d-photos', 'project-3d-photos', false, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Project members can view 3D photo files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-3d-photos'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND has_project_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Project members can upload 3D photo files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-3d-photos'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND has_project_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Project members can delete 3D photo files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-3d-photos'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND has_project_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
