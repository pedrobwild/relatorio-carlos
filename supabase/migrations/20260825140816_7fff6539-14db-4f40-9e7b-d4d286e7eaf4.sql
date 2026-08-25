-- 1) Tabela de versões
CREATE TABLE IF NOT EXISTS public.weekly_report_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.weekly_reports(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  week_number integer NOT NULL,
  version integer NOT NULL,
  data jsonb NOT NULL,
  restored_from_version integer,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, version)
);

CREATE INDEX IF NOT EXISTS idx_wrv_report ON public.weekly_report_versions(report_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_wrv_project_week ON public.weekly_report_versions(project_id, week_number);

GRANT SELECT ON public.weekly_report_versions TO authenticated;
GRANT ALL ON public.weekly_report_versions TO service_role;

ALTER TABLE public.weekly_report_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view report versions"
  ON public.weekly_report_versions
  FOR SELECT
  TO authenticated
  USING (public.has_project_access(auth.uid(), project_id));

-- 2) Trigger de snapshot automático
CREATE OR REPLACE FUNCTION public.snapshot_weekly_report_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_version integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.data IS NOT DISTINCT FROM OLD.data THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
  FROM public.weekly_report_versions
  WHERE report_id = NEW.id;

  INSERT INTO public.weekly_report_versions
    (report_id, project_id, week_number, version, data, created_by)
  VALUES
    (NEW.id, NEW.project_id, NEW.week_number, next_version, NEW.data,
     COALESCE(NEW.updated_by, NEW.created_by, auth.uid()));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_weekly_reports_snapshot ON public.weekly_reports;
CREATE TRIGGER trg_weekly_reports_snapshot
  AFTER INSERT OR UPDATE OF data ON public.weekly_reports
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_weekly_report_version();

-- 3) Backfill: versão 1 para relatórios existentes sem histórico
INSERT INTO public.weekly_report_versions (report_id, project_id, week_number, version, data, created_by, created_at)
SELECT wr.id, wr.project_id, wr.week_number, 1, wr.data, COALESCE(wr.updated_by, wr.created_by), wr.updated_at
FROM public.weekly_reports wr
WHERE NOT EXISTS (
  SELECT 1 FROM public.weekly_report_versions v WHERE v.report_id = wr.id
);

-- 4) Salvamento com controle de concorrência (optimistic locking)
CREATE OR REPLACE FUNCTION public.save_weekly_report(
  p_project_id uuid,
  p_week_number integer,
  p_week_start date,
  p_week_end date,
  p_data jsonb,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS public.weekly_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing public.weekly_reports;
  result public.weekly_reports;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para salvar relatórios' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_project_access(auth.uid(), p_project_id) THEN
    RAISE EXCEPTION 'Sem acesso a este projeto' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO existing
  FROM public.weekly_reports
  WHERE project_id = p_project_id AND week_number = p_week_number
  FOR UPDATE;

  IF existing.id IS NULL THEN
    INSERT INTO public.weekly_reports (project_id, week_number, week_start, week_end, data)
    VALUES (p_project_id, p_week_number, p_week_start, p_week_end, p_data)
    RETURNING * INTO result;
    RETURN result;
  END IF;

  IF p_expected_updated_at IS NOT NULL
     AND date_trunc('milliseconds', existing.updated_at) <> date_trunc('milliseconds', p_expected_updated_at) THEN
    RAISE EXCEPTION 'WEEKLY_REPORT_CONFLICT' USING ERRCODE = '40001';
  END IF;

  UPDATE public.weekly_reports
  SET week_start = p_week_start,
      week_end = p_week_end,
      data = p_data
  WHERE id = existing.id
  RETURNING * INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.save_weekly_report(uuid, integer, date, date, jsonb, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_weekly_report(uuid, integer, date, date, jsonb, timestamptz) TO authenticated;

-- 5) Restaurar versão anterior
CREATE OR REPLACE FUNCTION public.restore_weekly_report_version(p_version_id uuid)
RETURNS public.weekly_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.weekly_report_versions;
  result public.weekly_reports;
BEGIN
  SELECT * INTO v FROM public.weekly_report_versions WHERE id = p_version_id;
  IF v.id IS NULL THEN
    RAISE EXCEPTION 'Versão não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid())
     OR NOT public.has_project_access(auth.uid(), v.project_id) THEN
    RAISE EXCEPTION 'Sem permissão para restaurar esta versão' USING ERRCODE = '42501';
  END IF;

  UPDATE public.weekly_reports
  SET data = v.data
  WHERE id = v.report_id
  RETURNING * INTO result;

  UPDATE public.weekly_report_versions
  SET restored_from_version = v.version
  WHERE report_id = v.report_id
    AND version = (SELECT MAX(version) FROM public.weekly_report_versions WHERE report_id = v.report_id);

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_weekly_report_version(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_weekly_report_version(uuid) TO authenticated;