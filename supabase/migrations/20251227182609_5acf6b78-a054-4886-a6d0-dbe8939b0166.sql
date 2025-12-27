-- Add baseline columns to project_activities
ALTER TABLE public.project_activities
ADD COLUMN baseline_start date DEFAULT NULL,
ADD COLUMN baseline_end date DEFAULT NULL,
ADD COLUMN baseline_saved_at timestamp with time zone DEFAULT NULL;

-- Create index for baseline queries
CREATE INDEX idx_project_activities_baseline ON public.project_activities (project_id) WHERE baseline_saved_at IS NOT NULL;