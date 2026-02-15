
-- Add date columns to journey_stages for tracking proposed vs confirmed dates
ALTER TABLE public.journey_stages
  ADD COLUMN proposed_start date NULL,
  ADD COLUMN proposed_end date NULL,
  ADD COLUMN confirmed_start date NULL,
  ADD COLUMN confirmed_end date NULL;

-- Create audit log table for journey stage date changes
CREATE TABLE IF NOT EXISTS public.journey_stage_date_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage_id uuid NOT NULL REFERENCES public.journey_stages(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  field_name text NOT NULL, -- e.g. 'proposed_start', 'confirmed_end'
  old_value date NULL,
  new_value date NULL,
  changed_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.journey_stage_date_log ENABLE ROW LEVEL SECURITY;

-- RLS: staff can read all, customers can read their project's logs
CREATE POLICY "Staff can read all date logs"
  ON public.journey_stage_date_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'manager', 'engineer')
    )
  );

CREATE POLICY "Customers can read own project date logs"
  ON public.journey_stage_date_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_customers pc
      WHERE pc.project_id = journey_stage_date_log.project_id
        AND pc.customer_user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can insert date logs"
  ON public.journey_stage_date_log
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'manager', 'engineer')
    )
  );

-- Also allow customers to insert date logs (they propose dates)
CREATE POLICY "Customers can insert date logs for own projects"
  ON public.journey_stage_date_log
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_customers pc
      WHERE pc.project_id = journey_stage_date_log.project_id
        AND pc.customer_user_id = auth.uid()
    )
  );

-- Index for faster lookups
CREATE INDEX idx_journey_stage_date_log_stage ON public.journey_stage_date_log(stage_id);
CREATE INDEX idx_journey_stage_date_log_project ON public.journey_stage_date_log(project_id);
