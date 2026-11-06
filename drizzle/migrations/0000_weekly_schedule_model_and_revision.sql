ALTER TABLE public.project_templates ADD COLUMN IF NOT EXISTS schedule_model jsonb;
ALTER TABLE public.project_template_versions ADD COLUMN IF NOT EXISTS schedule_model jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS schedule_revision integer NOT NULL DEFAULT 0;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS schedule_exported_at timestamptz;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS schedule_exported_end date;
COMMENT ON COLUMN public.projects.schedule_revision IS 'Revisão do PDF do cronograma enviado ao cliente (R0, R1...)';
COMMENT ON COLUMN public.projects.schedule_exported_end IS 'Entrega prevista na última exportação do PDF do cronograma';

CREATE OR REPLACE FUNCTION public.save_template_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    OR OLD.schedule_model IS DISTINCT FROM NEW.schedule_model
  THEN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version
    FROM public.project_template_versions WHERE template_id = OLD.id;

    INSERT INTO public.project_template_versions (
      template_id, version_number, name, description, is_project_phase,
      default_activities, default_contract_value, category, custom_fields, schedule_model, created_by
    ) VALUES (
      OLD.id, v_version, OLD.name, OLD.description, OLD.is_project_phase,
      OLD.default_activities, OLD.default_contract_value, OLD.category, OLD.custom_fields,
      OLD.schedule_model, COALESCE(auth.uid(), OLD.created_by)
    );
  END IF;
  RETURN NEW;
END;
$function$;