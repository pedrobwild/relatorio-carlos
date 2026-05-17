-- Bug: uploads/updates to weekly-reports fail with `invalid_text_representation`
-- when the object path's first segment is not a valid UUID (legacy paths,
-- manual uploads, or a transient frontend bug).
--
-- Root cause: the INSERT and UPDATE policies created in
-- 20260506183356 still cast the first path segment directly to ::uuid:
--
--   has_project_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
--
-- A non-UUID segment raises invalid_text_representation, which aborts the
-- whole statement instead of evaluating to false. The SELECT policy was
-- already fixed in 20260509184127 by routing through
-- public.weekly_reports_path_has_access (SECURITY DEFINER, swallows the cast
-- error and also accepts the legacy {user_id}/{project_id}/... layout).
--
-- Fix: apply the same helper to INSERT and UPDATE. DELETE is staff-only and
-- performs no UUID cast, so it is left unchanged.

DROP POLICY IF EXISTS "Weekly reports: project members can upload" ON storage.objects;

CREATE POLICY "Weekly reports: project members can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'weekly-reports'
  AND (
    is_staff(auth.uid())
    OR public.weekly_reports_path_has_access(auth.uid(), name)
  )
);

DROP POLICY IF EXISTS "Weekly reports: project members can update" ON storage.objects;

CREATE POLICY "Weekly reports: project members can update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'weekly-reports'
  AND (
    is_staff(auth.uid())
    OR public.weekly_reports_path_has_access(auth.uid(), name)
  )
)
WITH CHECK (
  bucket_id = 'weekly-reports'
  AND (
    is_staff(auth.uid())
    OR public.weekly_reports_path_has_access(auth.uid(), name)
  )
);
