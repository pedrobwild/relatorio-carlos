-- Bug: customers can't view weekly-report media (photos/videos), only staff can.
--
-- Root cause: legacy uploads stored objects under {user_id}/{project_id}/week-N/...
-- (project_id in segment 2), while the SELECT policy in 20260506183356 only checks
-- segment 1 against has_project_access. Staff bypass via is_staff(), so they see
-- everything; customers fail has_project_access on a user_id and lose access to
-- legacy objects. New uploads use {project_id}/{user_id}/... so segment 1 already
-- matches.
--
-- Fix: extend the SELECT policy to also accept project_id in segment 2 (legacy
-- format). Wrapped in a SECURITY DEFINER helper that swallows invalid-uuid casts
-- so non-conforming paths don't error out the policy evaluation.

CREATE OR REPLACE FUNCTION public.weekly_reports_path_has_access(_user_id uuid, _name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  segs text[];
  pid uuid;
BEGIN
  IF _name IS NULL THEN
    RETURN false;
  END IF;

  segs := storage.foldername(_name);

  -- Current path layout: {project_id}/{user_id}/week-N/...
  IF array_length(segs, 1) >= 1 AND segs[1] IS NOT NULL THEN
    BEGIN
      pid := segs[1]::uuid;
      IF public.has_project_access(_user_id, pid) THEN
        RETURN true;
      END IF;
    EXCEPTION WHEN invalid_text_representation THEN
      -- segment 1 isn't a uuid, fall through
      NULL;
    END;
  END IF;

  -- Legacy path layout: {user_id}/{project_id}/week-N/...
  IF array_length(segs, 1) >= 2 AND segs[2] IS NOT NULL THEN
    BEGIN
      pid := segs[2]::uuid;
      IF public.has_project_access(_user_id, pid) THEN
        RETURN true;
      END IF;
    EXCEPTION WHEN invalid_text_representation THEN
      NULL;
    END;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.weekly_reports_path_has_access(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.weekly_reports_path_has_access(uuid, text) TO authenticated;

-- Replace SELECT policy to use the helper (covers both path layouts).
DROP POLICY IF EXISTS "Weekly reports: project members can view" ON storage.objects;

CREATE POLICY "Weekly reports: project members can view"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'weekly-reports'
  AND (
    is_staff(auth.uid())
    OR public.weekly_reports_path_has_access(auth.uid(), name)
  )
);
