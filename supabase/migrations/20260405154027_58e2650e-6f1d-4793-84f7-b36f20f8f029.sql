-- Add AI monitoring columns
ALTER TABLE public.integration_sync_log
  ADD COLUMN IF NOT EXISTS ai_diagnosis TEXT,
  ADD COLUMN IF NOT EXISTS corrected_payload JSONB;

-- Trigger function to call sync-monitor-agent on failure
CREATE OR REPLACE FUNCTION public.notify_sync_monitor_agent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_project_url text := 'https://fvblcyzdcqkiihyhfrrw.supabase.co';
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2YmxjeXpkY3FraWloeWhmcnJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTc3MzUsImV4cCI6MjA4MTMzMzczNX0.zrSOoXrdBh4QZLTbyprpuhXFalbWl9kHaRzBJjcEMIk';
  v_payload jsonb;
BEGIN
  -- Only trigger on failed status, max 3 attempts, and not already being processed
  IF NEW.sync_status = 'failed' 
     AND COALESCE(NEW.attempts, 0) < 3 
     AND (OLD IS NULL OR OLD.sync_status IS DISTINCT FROM 'failed') THEN
    
    v_payload := jsonb_build_object(
      'sync_log_id', NEW.id,
      'source_system', NEW.source_system,
      'target_system', NEW.target_system,
      'entity_type', NEW.entity_type,
      'source_id', NEW.source_id,
      'error_message', NEW.error_message,
      'payload', NEW.payload,
      'attempts', COALESCE(NEW.attempts, 0)
    );

    PERFORM net.http_post(
      url := v_project_url || '/functions/v1/sync-monitor-agent',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := v_payload
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_sync_monitor_agent] Failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_sync_monitor_on_failure ON public.integration_sync_log;
CREATE TRIGGER trg_sync_monitor_on_failure
  AFTER INSERT OR UPDATE ON public.integration_sync_log
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_sync_monitor_agent();