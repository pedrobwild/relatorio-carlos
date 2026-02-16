
-- Table for meeting availability submissions
CREATE TABLE public.journey_meeting_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage_id UUID NOT NULL REFERENCES public.journey_stages(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  preferred_weekdays TEXT[] NOT NULL DEFAULT '{}',
  time_slots TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending_confirmation' CHECK (status IN ('pending_confirmation', 'confirmed', 'cancelled')),
  confirmed_datetime TIMESTAMPTZ,
  confirmed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.journey_meeting_availability ENABLE ROW LEVEL SECURITY;

-- Staff can do everything
CREATE POLICY "Staff full access on meeting availability"
  ON public.journey_meeting_availability
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'gestor', 'engenheiro')
    )
  );

-- Customers can view and insert their own
CREATE POLICY "Customers can view meeting availability for their projects"
  ON public.journey_meeting_availability
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_customers
      WHERE project_customers.project_id = journey_meeting_availability.project_id
      AND project_customers.customer_user_id = auth.uid()
    )
  );

CREATE POLICY "Customers can insert meeting availability"
  ON public.journey_meeting_availability
  FOR INSERT
  WITH CHECK (
    auth.uid() = submitted_by
    AND EXISTS (
      SELECT 1 FROM public.project_customers
      WHERE project_customers.project_id = journey_meeting_availability.project_id
      AND project_customers.customer_user_id = auth.uid()
    )
  );

CREATE POLICY "Customers can update their own pending availability"
  ON public.journey_meeting_availability
  FOR UPDATE
  USING (
    submitted_by = auth.uid()
    AND status = 'pending_confirmation'
  );

-- Trigger for updated_at
CREATE TRIGGER update_meeting_availability_updated_at
  BEFORE UPDATE ON public.journey_meeting_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
