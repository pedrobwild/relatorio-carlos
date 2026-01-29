-- Allow customers linked via project_members (and legacy project_customers) to view schedules and weekly reports

-- =========================
-- project_activities (Cronograma)
-- =========================
ALTER TABLE public.project_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project members can view activities" ON public.project_activities;
CREATE POLICY "Project members can view activities"
ON public.project_activities
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.user_id = auth.uid()
      AND pm.project_id = project_activities.project_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.project_customers pc
    WHERE pc.customer_user_id = auth.uid()
      AND pc.project_id = project_activities.project_id
  )
);

-- =========================
-- weekly_reports (Relatórios)
-- =========================
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view weekly reports" ON public.weekly_reports;
CREATE POLICY "Members can view weekly reports"
ON public.weekly_reports
FOR SELECT
USING (
  (
    EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
        AND pm.project_id = weekly_reports.project_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.project_customers pc
      WHERE pc.customer_user_id = auth.uid()
        AND pc.project_id = weekly_reports.project_id
    )
  )
  AND (
    -- Staff can view all reports; customers only those already released
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'engineer')
    )
    OR (
      weekly_reports.available_at IS NOT NULL
      AND weekly_reports.available_at <= now()
    )
  )
);