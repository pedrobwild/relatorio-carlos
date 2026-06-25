-- Issue #82 — P0 #2, P0 #3, P2 #7
--
-- Bug: várias policies de storage.objects fazem cast direto
--   ((storage.foldername(name))[N])::uuid
-- dentro do USING/WITH CHECK. Quando o primeiro segmento do path não é um UUID
-- (paths legados, uploads manuais, ou bug transitório do frontend), o cast
-- levanta `invalid_text_representation` e ABORTA a query inteira em vez de
-- avaliar para `false` — o cliente vê galeria vazia / download quebrado, e o
-- upload falha. Mesma família já corrigida para `weekly-reports` em
-- 20260509184127 / 20260517120000 via helper SECURITY DEFINER.
--
-- Correção:
--   1) Helper genérico `storage_path_has_project_access` (modelo project_*),
--      que engole o cast inválido e ainda aceita project_id no segmento 1 ou 2
--      (layouts legados), espelhando `weekly_reports_path_has_access`.
--   2) Helpers `anexos_path_has_access` / `anexos_path_can_write` (modelo
--      has_obra_access + get_effective_role) para o bucket `anexos`.
--   3) Reescrever as policies bugadas dos buckets stage-photos,
--      project-documents, project-3d-photos, anexos e payment-boletos para usar
--      os helpers, e adicionar os UPDATE faltantes (stage-photos, 3d-photos).
--   4) payment-boletos SELECT passa a usar has_project_access (cobre clientes
--      legados de project_customers), corrigindo o P0 #3 (cliente não baixava
--      o próprio boleto quando vinculado só por project_customers).

-- =========================================================================
-- 1. Helper genérico (modelo project_*): swallow invalid uuid + 2 layouts
-- =========================================================================
CREATE OR REPLACE FUNCTION public.storage_path_has_project_access(_user_id uuid, _name text)
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

  -- Layout atual: {project_id}/...
  IF array_length(segs, 1) >= 1 AND segs[1] IS NOT NULL THEN
    BEGIN
      pid := segs[1]::uuid;
      IF public.has_project_access(_user_id, pid) THEN
        RETURN true;
      END IF;
    EXCEPTION WHEN invalid_text_representation THEN
      NULL; -- segmento 1 não é uuid: cai pro próximo
    END;
  END IF;

  -- Layout legado: {algo}/{project_id}/...
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

REVOKE ALL ON FUNCTION public.storage_path_has_project_access(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storage_path_has_project_access(uuid, text) TO authenticated;

-- =========================================================================
-- 2. Helpers do bucket `anexos` (modelo has_obra_access / get_effective_role)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.anexos_path_has_access(_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  segs text[];
  oid uuid;
BEGIN
  IF _name IS NULL THEN
    RETURN false;
  END IF;
  segs := storage.foldername(_name);
  IF array_length(segs, 1) >= 1 AND segs[1] IS NOT NULL THEN
    BEGIN
      oid := segs[1]::uuid;
      RETURN public.is_admin_v2() OR public.has_obra_access(oid);
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN false;
    END;
  END IF;
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.anexos_path_has_access(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.anexos_path_has_access(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.anexos_path_can_write(_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  segs text[];
  oid uuid;
BEGIN
  IF _name IS NULL THEN
    RETURN false;
  END IF;
  segs := storage.foldername(_name);
  IF array_length(segs, 1) >= 1 AND segs[1] IS NOT NULL THEN
    BEGIN
      oid := segs[1]::uuid;
      RETURN public.is_admin_v2()
        OR (
          public.has_obra_access(oid)
          AND public.get_effective_role(oid) NOT IN ('customer', 'cliente')
        );
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN false;
    END;
  END IF;
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.anexos_path_can_write(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.anexos_path_can_write(text) TO authenticated;

-- =========================================================================
-- 3. stage-photos — SELECT / INSERT / DELETE + UPDATE (faltava)
-- =========================================================================
DROP POLICY IF EXISTS "Project members can view stage photos" ON storage.objects;
CREATE POLICY "Project members can view stage photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'stage-photos'
  AND (is_staff(auth.uid()) OR public.storage_path_has_project_access(auth.uid(), name))
);

DROP POLICY IF EXISTS "Project members can upload stage photos" ON storage.objects;
CREATE POLICY "Project members can upload stage photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'stage-photos'
  AND (is_staff(auth.uid()) OR public.storage_path_has_project_access(auth.uid(), name))
);

DROP POLICY IF EXISTS "Project members can update stage photos" ON storage.objects;
CREATE POLICY "Project members can update stage photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'stage-photos'
  AND (is_staff(auth.uid()) OR public.storage_path_has_project_access(auth.uid(), name))
)
WITH CHECK (
  bucket_id = 'stage-photos'
  AND (is_staff(auth.uid()) OR public.storage_path_has_project_access(auth.uid(), name))
);

DROP POLICY IF EXISTS "Project members can delete stage photos" ON storage.objects;
CREATE POLICY "Project members can delete stage photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'stage-photos'
  AND (is_staff(auth.uid()) OR public.storage_path_has_project_access(auth.uid(), name))
);

-- =========================================================================
-- 4. project-documents — SELECT (staff bypass mantido)
-- =========================================================================
DROP POLICY IF EXISTS "Project members can view project documents" ON storage.objects;
CREATE POLICY "Project members can view project documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'project-documents'
  AND (is_staff(auth.uid()) OR public.storage_path_has_project_access(auth.uid(), name))
);

-- =========================================================================
-- 5. project-3d-photos — SELECT / INSERT / DELETE + UPDATE (faltava)
-- =========================================================================
DROP POLICY IF EXISTS "Project members can view 3D photo files" ON storage.objects;
CREATE POLICY "Project members can view 3D photo files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'project-3d-photos'
  AND (is_staff(auth.uid()) OR public.storage_path_has_project_access(auth.uid(), name))
);

DROP POLICY IF EXISTS "Project members can upload 3D photo files" ON storage.objects;
CREATE POLICY "Project members can upload 3D photo files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-3d-photos'
  AND (is_staff(auth.uid()) OR public.storage_path_has_project_access(auth.uid(), name))
);

DROP POLICY IF EXISTS "Project members can update 3D photo files" ON storage.objects;
CREATE POLICY "Project members can update 3D photo files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'project-3d-photos'
  AND (is_staff(auth.uid()) OR public.storage_path_has_project_access(auth.uid(), name))
)
WITH CHECK (
  bucket_id = 'project-3d-photos'
  AND (is_staff(auth.uid()) OR public.storage_path_has_project_access(auth.uid(), name))
);

DROP POLICY IF EXISTS "Project members can delete 3D photo files" ON storage.objects;
CREATE POLICY "Project members can delete 3D photo files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'project-3d-photos'
  AND (is_staff(auth.uid()) OR public.storage_path_has_project_access(auth.uid(), name))
);

-- =========================================================================
-- 6. anexos — SELECT / INSERT / UPDATE (DELETE é admin-only, fica)
--    Remove as duas INSERT existentes (upload_anexos_bucket e a duplicata
--    "Staff can upload anexos") e recria uma única.
-- =========================================================================
DROP POLICY IF EXISTS "read_anexos_bucket" ON storage.objects;
CREATE POLICY "read_anexos_bucket"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'anexos'
  AND public.anexos_path_has_access(name)
);

DROP POLICY IF EXISTS "upload_anexos_bucket" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload anexos" ON storage.objects;
CREATE POLICY "upload_anexos_bucket"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'anexos'
  AND public.anexos_path_can_write(name)
);

DROP POLICY IF EXISTS "update_anexos_bucket" ON storage.objects;
CREATE POLICY "update_anexos_bucket"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'anexos'
  AND public.anexos_path_can_write(name)
)
WITH CHECK (
  bucket_id = 'anexos'
  AND public.anexos_path_can_write(name)
);

-- =========================================================================
-- 7. payment-boletos — SELECT passa a usar has_project_access
--    (cobre clientes legados vinculados só por project_customers).
-- =========================================================================
DROP POLICY IF EXISTS "Users can view boletos for their projects" ON storage.objects;
CREATE POLICY "Users can view boletos for their projects"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment-boletos'
  AND public.storage_path_has_project_access(auth.uid(), name)
);
