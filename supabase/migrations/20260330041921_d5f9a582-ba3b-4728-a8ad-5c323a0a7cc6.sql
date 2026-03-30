-- Create database webhook trigger to call nc-notifications edge function
-- on INSERT and UPDATE of non_conformities table

CREATE OR REPLACE FUNCTION public.notify_nc_changes()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_payload jsonb;
  v_url text;
BEGIN
  v_url := current_setting('app.settings.supabase_url', true) 
    || '/functions/v1/nc-notifications';

  v_payload := jsonb_build_object(
    'type', TG_OP,
    'record', to_jsonb(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END
  );

  -- Use pg_net to call the edge function asynchronously
  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := v_payload
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_nc_notifications
  AFTER INSERT OR UPDATE ON public.non_conformities
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_nc_changes();