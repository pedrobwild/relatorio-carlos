-- ============================================================
-- Checklist + Galeria de fotos por atividade do cronograma
-- ------------------------------------------------------------
-- Adiciona duas estruturas vinculadas a `project_activities`:
--   1) project_activity_checklist_items
--      Itens de checklist técnicos por atividade (ex.: "teste de
--      estanqueidade assinado", "metais testados"). Cada item pode
--      ser marcado como done com timestamp e usuário.
--
--   2) project_activity_photos
--      Galeria de fotos por atividade. Os arquivos vivem no bucket
--      `activity-photos` (privado), e a tabela só guarda metadata.
--
-- Ambas reutilizam o mesmo padrão de RLS já consagrado em outras
-- tabelas project-scoped: leitura para project members ou customers
-- vinculados; escrita apenas para staff (engineer/admin).
-- ============================================================

-- 1) Checklist de atividades ------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_activity_checklist_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id  UUID NOT NULL REFERENCES public.project_activities(id) ON DELETE CASCADE,
  project_id   UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  position     INT  NOT NULL DEFAULT 0,
  is_done      BOOLEAN NOT NULL DEFAULT false,
  done_at      TIMESTAMPTZ NULL,
  done_by      UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_checklist_activity
  ON public.project_activity_checklist_items (activity_id, position);
CREATE INDEX IF NOT EXISTS idx_activity_checklist_project
  ON public.project_activity_checklist_items (project_id);

COMMENT ON TABLE public.project_activity_checklist_items IS
  'Itens de checklist técnico vinculados a uma atividade do cronograma.';

-- Trigger: mantém done_at/done_by sincronizados com is_done
CREATE OR REPLACE FUNCTION public.sync_checklist_done_meta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    IF NEW.is_done THEN
      NEW.done_at := COALESCE(NEW.done_at, now());
      NEW.done_by := COALESCE(NEW.done_by, auth.uid());
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_done IS DISTINCT FROM OLD.is_done THEN
      IF NEW.is_done THEN
        NEW.done_at := COALESCE(NEW.done_at, now());
        NEW.done_by := COALESCE(NEW.done_by, auth.uid());
      ELSE
        NEW.done_at := NULL;
        NEW.done_by := NULL;
      END IF;
    END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checklist_done_meta ON public.project_activity_checklist_items;
CREATE TRIGGER trg_checklist_done_meta
  BEFORE INSERT OR UPDATE ON public.project_activity_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_checklist_done_meta();

-- RLS: leitura para members/customers, escrita só para staff
ALTER TABLE public.project_activity_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "checklist_select_member_or_customer"
  ON public.project_activity_checklist_items;
CREATE POLICY "checklist_select_member_or_customer"
  ON public.project_activity_checklist_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
        AND pm.project_id = project_activity_checklist_items.project_id
    )
    OR EXISTS (
      SELECT 1 FROM public.project_customers pc
      WHERE pc.customer_user_id = auth.uid()
        AND pc.project_id = project_activity_checklist_items.project_id
    )
    OR public.is_staff(auth.uid())
  );

DROP POLICY IF EXISTS "checklist_insert_staff"
  ON public.project_activity_checklist_items;
CREATE POLICY "checklist_insert_staff"
  ON public.project_activity_checklist_items
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "checklist_update_staff"
  ON public.project_activity_checklist_items;
CREATE POLICY "checklist_update_staff"
  ON public.project_activity_checklist_items
  FOR UPDATE
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "checklist_delete_staff"
  ON public.project_activity_checklist_items;
CREATE POLICY "checklist_delete_staff"
  ON public.project_activity_checklist_items
  FOR DELETE
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- 2) Bucket de fotos ---------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'activity-photos',
  'activity-photos',
  false,
  15728640,                                           -- 15 MB
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Policies de storage para o bucket: paths são "<project_id>/<activity_id>/<file>"
DROP POLICY IF EXISTS "activity_photos_read"
  ON storage.objects;
CREATE POLICY "activity_photos_read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'activity-photos'
    AND (
      public.is_staff(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.project_id::text = (storage.foldername(name))[1]
      )
      OR EXISTS (
        SELECT 1 FROM public.project_customers pc
        WHERE pc.customer_user_id = auth.uid()
          AND pc.project_id::text = (storage.foldername(name))[1]
      )
    )
  );

DROP POLICY IF EXISTS "activity_photos_write_staff"
  ON storage.objects;
CREATE POLICY "activity_photos_write_staff"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'activity-photos'
    AND public.is_staff(auth.uid())
  );

DROP POLICY IF EXISTS "activity_photos_delete_staff"
  ON storage.objects;
CREATE POLICY "activity_photos_delete_staff"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'activity-photos'
    AND public.is_staff(auth.uid())
  );

-- 3) Tabela de metadata das fotos -------------------------------------
CREATE TABLE IF NOT EXISTS public.project_activity_photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id  UUID NOT NULL REFERENCES public.project_activities(id) ON DELETE CASCADE,
  project_id   UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,                        -- "<project_id>/<activity_id>/<file>"
  caption      TEXT NULL,
  mime_type    TEXT NULL,
  size_bytes   BIGINT NULL,
  width        INT NULL,
  height       INT NULL,
  uploaded_by  UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_photos_activity
  ON public.project_activity_photos (activity_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_photos_project
  ON public.project_activity_photos (project_id);

COMMENT ON TABLE public.project_activity_photos IS
  'Galeria de fotos vinculadas a uma atividade do cronograma.';

ALTER TABLE public.project_activity_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_photos_meta_select_member_or_customer"
  ON public.project_activity_photos;
CREATE POLICY "activity_photos_meta_select_member_or_customer"
  ON public.project_activity_photos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
        AND pm.project_id = project_activity_photos.project_id
    )
    OR EXISTS (
      SELECT 1 FROM public.project_customers pc
      WHERE pc.customer_user_id = auth.uid()
        AND pc.project_id = project_activity_photos.project_id
    )
    OR public.is_staff(auth.uid())
  );

DROP POLICY IF EXISTS "activity_photos_meta_insert_staff"
  ON public.project_activity_photos;
CREATE POLICY "activity_photos_meta_insert_staff"
  ON public.project_activity_photos
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "activity_photos_meta_update_staff"
  ON public.project_activity_photos;
CREATE POLICY "activity_photos_meta_update_staff"
  ON public.project_activity_photos
  FOR UPDATE
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "activity_photos_meta_delete_staff"
  ON public.project_activity_photos;
CREATE POLICY "activity_photos_meta_delete_staff"
  ON public.project_activity_photos
  FOR DELETE
  TO authenticated
  USING (public.is_staff(auth.uid()));
