-- Add usage tracking columns to project_templates
ALTER TABLE public.project_templates
ADD COLUMN usage_count integer DEFAULT 0,
ADD COLUMN last_used_at timestamptz;

-- Create index for sorting by usage
CREATE INDEX idx_project_templates_usage ON public.project_templates(usage_count DESC);

-- Function to increment template usage
CREATE OR REPLACE FUNCTION public.increment_template_usage(p_template_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.project_templates
  SET usage_count = usage_count + 1,
      last_used_at = now()
  WHERE id = p_template_id;
END;
$$;