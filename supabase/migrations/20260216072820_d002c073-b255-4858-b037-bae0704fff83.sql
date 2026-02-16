
-- Stage records: decisions, conversations, history entries per stage
CREATE TABLE public.journey_stage_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage_id uuid NOT NULL REFERENCES public.journey_stages(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('decision', 'conversation', 'history')),
  title text NOT NULL,
  description text,
  record_date date NOT NULL DEFAULT CURRENT_DATE,
  responsible text NOT NULL DEFAULT 'bwild' CHECK (responsible IN ('client', 'bwild')),
  evidence_url text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX idx_stage_records_stage ON public.journey_stage_records(stage_id, category);
CREATE INDEX idx_stage_records_project ON public.journey_stage_records(project_id);

-- Auto-update updated_at
CREATE TRIGGER trg_stage_records_updated_at
  BEFORE UPDATE ON public.journey_stage_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.journey_stage_records ENABLE ROW LEVEL SECURITY;

-- Read: anyone with project access
CREATE POLICY "Members can view stage records"
  ON public.journey_stage_records FOR SELECT
  USING (public.has_project_access(auth.uid(), project_id));

-- Insert: staff only
CREATE POLICY "Staff can create stage records"
  ON public.journey_stage_records FOR INSERT
  WITH CHECK (public.user_is_staff_or_above(auth.uid()));

-- Update: staff only
CREATE POLICY "Staff can update stage records"
  ON public.journey_stage_records FOR UPDATE
  USING (public.user_is_staff_or_above(auth.uid()));

-- Delete: staff only
CREATE POLICY "Staff can delete stage records"
  ON public.journey_stage_records FOR DELETE
  USING (public.user_is_staff_or_above(auth.uid()));
