ALTER TABLE public.non_conformities
  ADD COLUMN IF NOT EXISTS reopen_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_reopen_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'reopened' AND OLD.status != 'reopened' THEN
    NEW.reopen_count := OLD.reopen_count + 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_nc_reopen_count
  BEFORE UPDATE ON public.non_conformities
  FOR EACH ROW EXECUTE FUNCTION public.increment_reopen_count();