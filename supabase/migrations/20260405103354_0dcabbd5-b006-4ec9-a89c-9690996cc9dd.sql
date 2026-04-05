
-- ============================================================
-- 1. Make public buckets private
-- ============================================================
UPDATE storage.buckets SET public = false WHERE id = 'project-documents';
UPDATE storage.buckets SET public = false WHERE id = 'weekly-reports';

-- ============================================================
-- 2. Fix stage-photos: drop overly permissive SELECT policy
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view stage photos" ON storage.objects;

-- Add proper scoped SELECT for stage-photos
CREATE POLICY "Project members can view stage photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'stage-photos'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND has_project_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- ============================================================
-- 3. Fix documentos-rh: restrict SELECT to admin only
-- ============================================================
DROP POLICY IF EXISTS "documentos_rh_auth_select" ON storage.objects;

CREATE POLICY "documentos_rh_admin_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documentos-rh'
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- ============================================================
-- 4. Fix payment-boletos: drop unscoped SELECT policy
-- ============================================================
DROP POLICY IF EXISTS "Project members can view boletos" ON storage.objects;
-- The scoped "Users can view boletos for their projects" policy remains

-- ============================================================
-- 5. Fix project-documents: replace broad SELECT with scoped one
-- ============================================================
DROP POLICY IF EXISTS "Users with access can view project documents" ON storage.objects;

CREATE POLICY "Project members can view project documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'project-documents'
  AND (
    is_staff(auth.uid())
    OR (
      (storage.foldername(name))[1] IS NOT NULL
      AND has_project_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  )
);

-- Add missing UPDATE policy for project-documents
CREATE POLICY "Staff can update project documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'project-documents'
  AND is_staff(auth.uid())
);

-- ============================================================
-- 6. Fix weekly-reports: replace public SELECT with project-scoped
-- ============================================================
DROP POLICY IF EXISTS "Public can view weekly-reports files" ON storage.objects;

CREATE POLICY "Project members can view weekly reports"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'weekly-reports'
  AND (
    is_staff(auth.uid())
    OR (
      (storage.foldername(name))[1] IS NOT NULL
      AND has_project_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  )
);

-- ============================================================
-- 7. Fix anexos: add missing INSERT policy
-- ============================================================
CREATE POLICY "Staff can upload anexos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'anexos'
  AND (
    is_admin_v2()
    OR (
      has_obra_access(((storage.foldername(name))[1])::uuid)
      AND get_effective_role(((storage.foldername(name))[1])::uuid) NOT IN ('customer', 'cliente')
    )
  )
);
