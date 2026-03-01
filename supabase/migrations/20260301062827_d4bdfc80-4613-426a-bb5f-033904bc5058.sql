-- Add stage_context column to differentiate team members between stages
ALTER TABLE public.journey_team_members
  ADD COLUMN stage_context text NOT NULL DEFAULT 'welcome';

-- Create index for efficient filtering
CREATE INDEX idx_journey_team_members_stage_context ON public.journey_team_members(project_id, stage_context);