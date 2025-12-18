-- Create project_activities table for storing project schedule/cronograma
CREATE TABLE public.project_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  planned_start DATE NOT NULL,
  planned_end DATE NOT NULL,
  actual_start DATE,
  actual_end DATE,
  weight NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (weight >= 0 AND weight <= 100),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  
  CONSTRAINT valid_planned_dates CHECK (planned_end >= planned_start),
  CONSTRAINT valid_actual_dates CHECK (actual_end IS NULL OR actual_start IS NULL OR actual_end >= actual_start)
);

-- Create index for efficient querying by project
CREATE INDEX idx_project_activities_project_id ON public.project_activities(project_id, sort_order);

-- Enable RLS
ALTER TABLE public.project_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users with project access can view activities"
  ON public.project_activities
  FOR SELECT
  USING (has_project_access(auth.uid(), project_id));

CREATE POLICY "Staff can manage activities"
  ON public.project_activities
  FOR ALL
  USING (is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id));

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_project_activity_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_project_activities_updated_at
  BEFORE UPDATE ON public.project_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_project_activity_updated_at();