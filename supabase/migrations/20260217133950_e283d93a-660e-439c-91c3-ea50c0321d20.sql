
-- Add category column to project_templates
ALTER TABLE public.project_templates 
ADD COLUMN category text DEFAULT 'geral';

-- Add index for category filtering
CREATE INDEX idx_project_templates_category ON public.project_templates(category);
