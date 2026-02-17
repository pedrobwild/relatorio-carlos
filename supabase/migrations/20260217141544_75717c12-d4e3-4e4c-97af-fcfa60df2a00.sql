
-- Template versioning: store snapshots on update
CREATE TABLE public.project_template_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.project_templates(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  name text NOT NULL,
  description text,
  is_project_phase boolean NOT NULL DEFAULT false,
  default_activities jsonb DEFAULT '[]'::jsonb,
  default_contract_value numeric,
  category text,
  custom_fields jsonb DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(template_id, version_number)
);

ALTER TABLE public.project_template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view template versions"
  ON public.project_template_versions FOR SELECT
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can insert template versions"
  ON public.project_template_versions FOR INSERT
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- Auto-save version on template update
CREATE OR REPLACE FUNCTION public.save_template_version()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_version integer;
BEGIN
  IF OLD.name IS DISTINCT FROM NEW.name
    OR OLD.description IS DISTINCT FROM NEW.description
    OR OLD.default_activities IS DISTINCT FROM NEW.default_activities
    OR OLD.default_contract_value IS DISTINCT FROM NEW.default_contract_value
    OR OLD.is_project_phase IS DISTINCT FROM NEW.is_project_phase
    OR OLD.category IS DISTINCT FROM NEW.category
    OR OLD.custom_fields IS DISTINCT FROM NEW.custom_fields
  THEN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version
    FROM public.project_template_versions WHERE template_id = OLD.id;
    
    INSERT INTO public.project_template_versions (
      template_id, version_number, name, description, is_project_phase,
      default_activities, default_contract_value, category, custom_fields, created_by
    ) VALUES (
      OLD.id, v_version, OLD.name, OLD.description, OLD.is_project_phase,
      OLD.default_activities, OLD.default_contract_value, OLD.category, OLD.custom_fields, 
      COALESCE(auth.uid(), OLD.created_by)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_save_template_version
  BEFORE UPDATE ON public.project_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.save_template_version();

-- Add custom_fields column to project_templates
ALTER TABLE public.project_templates
ADD COLUMN custom_fields jsonb DEFAULT '[]'::jsonb;
