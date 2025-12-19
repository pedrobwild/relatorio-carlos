-- Add predecessor_ids column to project_activities table for activity dependencies
ALTER TABLE public.project_activities 
ADD COLUMN predecessor_ids UUID[] DEFAULT '{}';

-- Add comment explaining the column
COMMENT ON COLUMN public.project_activities.predecessor_ids IS 'Array of activity IDs that must complete before this activity can start';