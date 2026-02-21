
-- P0: Harden comment UPDATE policy to also verify project access
DROP POLICY IF EXISTS "Authors can update 3d comments" ON public.project_3d_comments;
CREATE POLICY "Authors can update 3d comments"
  ON public.project_3d_comments FOR UPDATE
  USING (
    auth.uid() = author_user_id
    AND EXISTS (
      SELECT 1 FROM public.project_3d_images i
      JOIN public.project_3d_versions v ON v.id = i.version_id
      WHERE i.id = project_3d_comments.image_id
        AND public.has_project_access(auth.uid(), v.project_id)
    )
  );

-- Add index for faster comment lookups by image_id
CREATE INDEX IF NOT EXISTS idx_3d_comments_image_id ON public.project_3d_comments (image_id);

-- Add index for faster image lookups by version_id
CREATE INDEX IF NOT EXISTS idx_3d_images_version_id ON public.project_3d_images (version_id);
