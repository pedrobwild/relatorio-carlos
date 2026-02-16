
-- Stage dates: granular date entries per stage
CREATE TABLE public.stage_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_key text NOT NULL,
  date_type text NOT NULL CHECK (date_type IN ('meeting','deadline','start_planned','end_planned','milestone')),
  title text NOT NULL,
  customer_proposed_at timestamptz,
  bwild_confirmed_at timestamptz,
  customer_proposed_by uuid,
  bwild_confirmed_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stage_dates ENABLE ROW LEVEL SECURITY;

-- Staff can do everything
CREATE POLICY "Staff can manage stage_dates"
  ON public.stage_dates FOR ALL
  USING (is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id));

-- Customers can view their project's dates
CREATE POLICY "Customers can view stage_dates"
  ON public.stage_dates FOR SELECT
  USING (has_project_access(auth.uid(), project_id));

-- Customers can insert (propose) dates for their projects
CREATE POLICY "Customers can insert stage_dates"
  ON public.stage_dates FOR INSERT
  WITH CHECK (
    has_project_access(auth.uid(), project_id)
    AND customer_proposed_by = auth.uid()
    AND bwild_confirmed_at IS NULL
    AND bwild_confirmed_by IS NULL
  );

-- Customers can update only their proposal fields
CREATE POLICY "Customers can update proposals"
  ON public.stage_dates FOR UPDATE
  USING (
    has_project_access(auth.uid(), project_id)
    AND NOT is_staff(auth.uid())
  );

-- Audit log for stage date changes
CREATE TABLE public.stage_date_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_date_id uuid NOT NULL REFERENCES public.stage_dates(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL,
  actor_role text NOT NULL,
  action text NOT NULL CHECK (action IN ('created','proposed','confirmed','updated','cancelled')),
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stage_date_events ENABLE ROW LEVEL SECURITY;

-- Staff can manage events
CREATE POLICY "Staff can manage stage_date_events"
  ON public.stage_date_events FOR ALL
  USING (is_staff(auth.uid()));

-- Anyone with project access can view events (via join)
CREATE POLICY "Users can view stage_date_events"
  ON public.stage_date_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.stage_dates sd
      WHERE sd.id = stage_date_events.stage_date_id
      AND has_project_access(auth.uid(), sd.project_id)
    )
  );

-- Customers can insert events for their actions
CREATE POLICY "Customers can insert stage_date_events"
  ON public.stage_date_events FOR INSERT
  WITH CHECK (
    actor_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.stage_dates sd
      WHERE sd.id = stage_date_events.stage_date_id
      AND has_project_access(auth.uid(), sd.project_id)
    )
  );

-- Prevent updates/deletes on audit log
CREATE POLICY "No update on stage_date_events"
  ON public.stage_date_events FOR UPDATE USING (false);
CREATE POLICY "No delete on stage_date_events"
  ON public.stage_date_events FOR DELETE USING (false);

-- Auto-update updated_at
CREATE TRIGGER update_stage_dates_updated_at
  BEFORE UPDATE ON public.stage_dates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_stage_dates_project_key ON public.stage_dates(project_id, stage_key);
CREATE INDEX idx_stage_date_events_date_id ON public.stage_date_events(stage_date_id);
