-- Trigger to normalize site-access fields on project_studio_info
CREATE OR REPLACE FUNCTION public.normalize_studio_access_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.key_location IS NOT NULL THEN
    NEW.key_location := NULLIF(btrim(NEW.key_location), '');
  END IF;
  IF NEW.electronic_lock_password IS NOT NULL THEN
    NEW.electronic_lock_password := NULLIF(btrim(NEW.electronic_lock_password), '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_studio_access_fields ON public.project_studio_info;

CREATE TRIGGER trg_normalize_studio_access_fields
BEFORE INSERT OR UPDATE OF key_location, electronic_lock_password
ON public.project_studio_info
FOR EACH ROW
EXECUTE FUNCTION public.normalize_studio_access_fields();