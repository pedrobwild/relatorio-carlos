
-- ============================================================
-- Projeto 3D Versions, Images & Comments
-- ============================================================

-- 1. Versions table
CREATE TABLE public.project_3d_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_key TEXT NOT NULL DEFAULT 'projeto_3d',
  version_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  UNIQUE (project_id, stage_key, version_number)
);

ALTER TABLE public.project_3d_versions ENABLE ROW LEVEL SECURITY;

-- Staff + project members can read
CREATE POLICY "Members can view 3d versions"
  ON public.project_3d_versions FOR SELECT
  USING (public.has_project_access(auth.uid(), project_id));

-- Staff can insert
CREATE POLICY "Staff can create 3d versions"
  ON public.project_3d_versions FOR INSERT
  WITH CHECK (public.user_is_staff_or_above(auth.uid()) AND public.has_project_access(auth.uid(), project_id));

-- Staff can delete
CREATE POLICY "Staff can delete 3d versions"
  ON public.project_3d_versions FOR DELETE
  USING (public.user_is_staff_or_above(auth.uid()) AND public.has_project_access(auth.uid(), project_id));

-- 2. Images table
CREATE TABLE public.project_3d_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version_id UUID NOT NULL REFERENCES public.project_3d_versions(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_3d_images ENABLE ROW LEVEL SECURITY;

-- Members can view images (via version -> project access)
CREATE POLICY "Members can view 3d images"
  ON public.project_3d_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_3d_versions v
      WHERE v.id = version_id
        AND public.has_project_access(auth.uid(), v.project_id)
    )
  );

-- Staff can insert images
CREATE POLICY "Staff can create 3d images"
  ON public.project_3d_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_3d_versions v
      WHERE v.id = version_id
        AND public.user_is_staff_or_above(auth.uid())
        AND public.has_project_access(auth.uid(), v.project_id)
    )
  );

-- Staff can delete images
CREATE POLICY "Staff can delete 3d images"
  ON public.project_3d_images FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_3d_versions v
      WHERE v.id = version_id
        AND public.user_is_staff_or_above(auth.uid())
        AND public.has_project_access(auth.uid(), v.project_id)
    )
  );

-- 3. Comments table (draggable pins)
CREATE TABLE public.project_3d_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_id UUID NOT NULL REFERENCES public.project_3d_images(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL,
  text TEXT NOT NULL,
  x_percent NUMERIC(6,3) NOT NULL CHECK (x_percent >= 0 AND x_percent <= 100),
  y_percent NUMERIC(6,3) NOT NULL CHECK (y_percent >= 0 AND y_percent <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_3d_comments ENABLE ROW LEVEL SECURITY;

-- Members can view comments
CREATE POLICY "Members can view 3d comments"
  ON public.project_3d_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_3d_images i
      JOIN public.project_3d_versions v ON v.id = i.version_id
      WHERE i.id = image_id
        AND public.has_project_access(auth.uid(), v.project_id)
    )
  );

-- Any project member can create comments (staff + customer)
CREATE POLICY "Members can create 3d comments"
  ON public.project_3d_comments FOR INSERT
  WITH CHECK (
    auth.uid() = author_user_id
    AND EXISTS (
      SELECT 1 FROM public.project_3d_images i
      JOIN public.project_3d_versions v ON v.id = i.version_id
      WHERE i.id = image_id
        AND public.has_project_access(auth.uid(), v.project_id)
    )
  );

-- Authors can update their own comments
CREATE POLICY "Authors can update 3d comments"
  ON public.project_3d_comments FOR UPDATE
  USING (auth.uid() = author_user_id);

-- Authors + staff can delete comments
CREATE POLICY "Authors or staff can delete 3d comments"
  ON public.project_3d_comments FOR DELETE
  USING (
    auth.uid() = author_user_id
    OR public.user_is_staff_or_above(auth.uid())
  );

-- Auto-update updated_at
CREATE TRIGGER update_3d_comments_updated_at
  BEFORE UPDATE ON public.project_3d_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Storage: Use existing project-documents bucket (public)
-- Images will be stored at: projects/{projectId}/3d/{versionId}/{filename}
-- RLS policies already exist for project-documents bucket
