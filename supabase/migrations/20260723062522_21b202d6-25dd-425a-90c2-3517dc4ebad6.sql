-- ============================================================================
-- Onda C2 — Diário de obra: severity + fotos do dia
-- ============================================================================

-- 1) Severidade da ocorrência do dia (aditivo, opcional)
ALTER TABLE public.project_daily_logs
  ADD COLUMN IF NOT EXISTS occurrence_severity text
    CHECK (occurrence_severity IN ('Baixa','Média','Alta'));

COMMENT ON COLUMN public.project_daily_logs.occurrence_severity IS
  'Severidade da ocorrência registrada em notes. Baixa/Média/Alta. Opcional.';

-- 2) Fotos do RDO
CREATE TABLE IF NOT EXISTS public.project_daily_log_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id uuid NOT NULL REFERENCES public.project_daily_logs(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  storage_path text NOT NULL,
  caption text,
  sort_order integer NOT NULL DEFAULT 0,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_daily_log_photos_log_idx
  ON public.project_daily_log_photos (daily_log_id, sort_order);
CREATE INDEX IF NOT EXISTS project_daily_log_photos_project_idx
  ON public.project_daily_log_photos (project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_daily_log_photos TO authenticated;
GRANT ALL ON public.project_daily_log_photos TO service_role;

ALTER TABLE public.project_daily_log_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff pode visualizar fotos do RDO" ON public.project_daily_log_photos;
CREATE POLICY "Staff pode visualizar fotos do RDO"
  ON public.project_daily_log_photos FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff pode inserir fotos do RDO" ON public.project_daily_log_photos;
CREATE POLICY "Staff pode inserir fotos do RDO"
  ON public.project_daily_log_photos FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff pode atualizar fotos do RDO" ON public.project_daily_log_photos;
CREATE POLICY "Staff pode atualizar fotos do RDO"
  ON public.project_daily_log_photos FOR UPDATE
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff pode remover fotos do RDO" ON public.project_daily_log_photos;
CREATE POLICY "Staff pode remover fotos do RDO"
  ON public.project_daily_log_photos FOR DELETE
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- 3) Bucket privado daily-log-photos — políticas de acesso
DROP POLICY IF EXISTS "Staff lê fotos do diário" ON storage.objects;
CREATE POLICY "Staff lê fotos do diário"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'daily-log-photos' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff envia fotos do diário" ON storage.objects;
CREATE POLICY "Staff envia fotos do diário"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'daily-log-photos' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff atualiza fotos do diário" ON storage.objects;
CREATE POLICY "Staff atualiza fotos do diário"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'daily-log-photos' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'daily-log-photos' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff remove fotos do diário" ON storage.objects;
CREATE POLICY "Staff remove fotos do diário"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'daily-log-photos' AND public.is_staff(auth.uid()));
