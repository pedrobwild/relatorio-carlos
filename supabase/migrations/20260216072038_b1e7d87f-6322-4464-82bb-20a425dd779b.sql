
-- Add waiting_since to track when stage entered waiting_on=client
ALTER TABLE public.journey_stages
  ADD COLUMN IF NOT EXISTS waiting_since timestamptz DEFAULT NULL;

-- Create trigger to auto-set waiting_since when status changes
CREATE OR REPLACE FUNCTION public.journey_stage_waiting_tracker()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- When status changes TO waiting_action, record the timestamp
  IF NEW.status = 'waiting_action' AND (OLD.status IS DISTINCT FROM 'waiting_action') THEN
    NEW.waiting_since = now();
  END IF;

  -- When status changes FROM waiting_action to something else, clear it
  IF OLD.status = 'waiting_action' AND NEW.status != 'waiting_action' THEN
    NEW.waiting_since = NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_journey_stage_waiting_tracker
  BEFORE UPDATE ON public.journey_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.journey_stage_waiting_tracker();
