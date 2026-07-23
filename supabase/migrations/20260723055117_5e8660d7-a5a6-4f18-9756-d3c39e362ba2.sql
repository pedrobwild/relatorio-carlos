-- ==========================================================
-- Onda A1: activity_progress_measurements
-- ==========================================================
CREATE TABLE public.activity_progress_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.project_activities(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  measured_on date NOT NULL DEFAULT CURRENT_DATE,
  progress_pct numeric(5,2) NOT NULL CHECK (progress_pct >= 0 AND progress_pct <= 100),
  notes text,
  measured_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_apm_activity_date
  ON public.activity_progress_measurements(activity_id, measured_on DESC);
CREATE INDEX idx_apm_project_date
  ON public.activity_progress_measurements(project_id, measured_on DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_progress_measurements TO authenticated;
GRANT ALL ON public.activity_progress_measurements TO service_role;

ALTER TABLE public.activity_progress_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view progress measurements"
  ON public.activity_progress_measurements
  FOR SELECT
  TO authenticated
  USING (is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id));

CREATE POLICY "Staff can manage progress measurements"
  ON public.activity_progress_measurements
  FOR ALL
  TO authenticated
  USING (is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id))
  WITH CHECK (is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id));

-- ==========================================================
-- Onda A1: schedule_baselines
-- ==========================================================
CREATE TABLE public.schedule_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  notes text,
  is_current boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_schedule_baselines_project
  ON public.schedule_baselines(project_id, created_at DESC);
CREATE UNIQUE INDEX idx_schedule_baselines_current_per_project
  ON public.schedule_baselines(project_id)
  WHERE is_current = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_baselines TO authenticated;
GRANT ALL ON public.schedule_baselines TO service_role;

ALTER TABLE public.schedule_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view schedule baselines"
  ON public.schedule_baselines
  FOR SELECT
  TO authenticated
  USING (is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id));

CREATE POLICY "Staff can manage schedule baselines"
  ON public.schedule_baselines
  FOR ALL
  TO authenticated
  USING (is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id))
  WITH CHECK (is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id));

-- ==========================================================
-- Onda A1: schedule_baseline_activities (snapshot congelado)
-- ==========================================================
CREATE TABLE public.schedule_baseline_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_id uuid NOT NULL REFERENCES public.schedule_baselines(id) ON DELETE CASCADE,
  activity_id uuid,
  description text NOT NULL,
  planned_start date NOT NULL,
  planned_end date NOT NULL,
  weight numeric(5,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  parent_activity_id uuid,
  etapa text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sba_valid_dates CHECK (planned_end >= planned_start),
  CONSTRAINT sba_valid_weight CHECK (weight >= 0 AND weight <= 100)
);

CREATE INDEX idx_sba_baseline
  ON public.schedule_baseline_activities(baseline_id, sort_order);
CREATE INDEX idx_sba_activity
  ON public.schedule_baseline_activities(activity_id)
  WHERE activity_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_baseline_activities TO authenticated;
GRANT ALL ON public.schedule_baseline_activities TO service_role;

ALTER TABLE public.schedule_baseline_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view baseline activities"
  ON public.schedule_baseline_activities
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.schedule_baselines b
    WHERE b.id = baseline_id
      AND is_staff(auth.uid())
      AND has_project_access(auth.uid(), b.project_id)
  ));

CREATE POLICY "Staff can manage baseline activities"
  ON public.schedule_baseline_activities
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.schedule_baselines b
    WHERE b.id = baseline_id
      AND is_staff(auth.uid())
      AND has_project_access(auth.uid(), b.project_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.schedule_baselines b
    WHERE b.id = baseline_id
      AND is_staff(auth.uid())
      AND has_project_access(auth.uid(), b.project_id)
  ));