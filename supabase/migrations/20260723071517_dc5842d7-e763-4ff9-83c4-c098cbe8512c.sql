
CREATE TABLE IF NOT EXISTS public.internal_weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_weekly_reports TO authenticated;
GRANT ALL ON public.internal_weekly_reports TO service_role;

ALTER TABLE public.internal_weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS internal_weekly_reports_unique_active
  ON public.internal_weekly_reports (project_id, week_start)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS internal_weekly_reports_project_week_idx
  ON public.internal_weekly_reports (project_id, week_start DESC);

DROP POLICY IF EXISTS "Staff can view internal weekly reports" ON public.internal_weekly_reports;
CREATE POLICY "Staff can view internal weekly reports"
  ON public.internal_weekly_reports FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can insert internal weekly reports" ON public.internal_weekly_reports;
CREATE POLICY "Staff can insert internal weekly reports"
  ON public.internal_weekly_reports FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can update internal weekly reports" ON public.internal_weekly_reports;
CREATE POLICY "Staff can update internal weekly reports"
  ON public.internal_weekly_reports FOR UPDATE
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can delete internal weekly reports" ON public.internal_weekly_reports;
CREATE POLICY "Staff can delete internal weekly reports"
  ON public.internal_weekly_reports FOR DELETE
  TO authenticated
  USING (public.is_staff(auth.uid()));

DROP TRIGGER IF EXISTS trg_internal_weekly_reports_updated_at ON public.internal_weekly_reports;
CREATE TRIGGER trg_internal_weekly_reports_updated_at
  BEFORE UPDATE ON public.internal_weekly_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
