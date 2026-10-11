-- ============================================================================
-- Fase 3 — Tela Hoje: fotos de campo da camada de Operação
--
-- Bucket privado `ops-photos`. Caminho obrigatório:
--   <project_id>/<assignment_id>/<arquivo>
-- Só staff com acesso à obra (primeiro segmento do caminho) lê, envia ou
-- remove. Nenhuma policy para cliente: as fotos de campo são internas. O que o
-- cliente vê continua indo pelo relatório semanal.
-- Idempotente.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ops-photos',
  'ops-photos',
  false,
  10485760, -- 10 MB (o app comprime para ~0,6 MB antes de enviar)
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Extrai o project_id do caminho sem quebrar em caminhos malformados.
CREATE OR REPLACE FUNCTION public.ops_photo_project_id(_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN split_part(_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN split_part(_name, '/', 1)::uuid
    ELSE NULL
  END
$$;

DROP POLICY IF EXISTS "ops_photos_select" ON storage.objects;
CREATE POLICY "ops_photos_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'ops-photos'
    AND public.is_staff(auth.uid())
    AND public.has_project_access(auth.uid(), public.ops_photo_project_id(name))
  );

DROP POLICY IF EXISTS "ops_photos_insert" ON storage.objects;
CREATE POLICY "ops_photos_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'ops-photos'
    AND public.is_staff(auth.uid())
    AND public.has_project_access(auth.uid(), public.ops_photo_project_id(name))
  );

DROP POLICY IF EXISTS "ops_photos_delete" ON storage.objects;
CREATE POLICY "ops_photos_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'ops-photos'
    AND public.is_staff(auth.uid())
    AND public.has_project_access(auth.uid(), public.ops_photo_project_id(name))
  );
