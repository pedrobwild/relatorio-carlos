-- Add field to track if project is in project phase (pre-construction)
ALTER TABLE public.projects 
ADD COLUMN is_project_phase boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.projects.is_project_phase IS 'Indicates if project is still in design/planning phase before construction starts';