-- ============================================================================
-- Files Cleanup Helper View and Trigger
-- ============================================================================

-- View to easily identify cleanup candidates
CREATE OR REPLACE VIEW public.files_cleanup_candidates AS
SELECT 
  id,
  bucket,
  storage_path,
  status,
  deleted_at,
  expires_at,
  retention_days,
  created_at,
  CASE 
    WHEN expires_at IS NOT NULL AND expires_at <= now() THEN 'expired'
    WHEN status = 'deleted' AND deleted_at < now() - interval '7 days' THEN 'grace_period_passed'
    ELSE 'unknown'
  END AS cleanup_reason
FROM public.files
WHERE 
  (status = 'deleted' AND deleted_at < now() - interval '7 days')
  OR (expires_at IS NOT NULL AND expires_at <= now());

-- Grant access to authenticated users (view only for admins via RLS)
GRANT SELECT ON public.files_cleanup_candidates TO authenticated;

-- Function to auto-populate expires_at based on retention_days
CREATE OR REPLACE FUNCTION public.set_file_expires_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set expires_at if retention_days is specified and expires_at is not already set
  IF NEW.retention_days IS NOT NULL AND NEW.expires_at IS NULL THEN
    NEW.expires_at := NEW.created_at + (NEW.retention_days || ' days')::interval;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-set expires_at on insert
DROP TRIGGER IF EXISTS trigger_set_file_expires_at ON public.files;
CREATE TRIGGER trigger_set_file_expires_at
  BEFORE INSERT ON public.files
  FOR EACH ROW
  EXECUTE FUNCTION public.set_file_expires_at();

-- Also handle updates where retention_days changes
DROP TRIGGER IF EXISTS trigger_update_file_expires_at ON public.files;
CREATE TRIGGER trigger_update_file_expires_at
  BEFORE UPDATE OF retention_days ON public.files
  FOR EACH ROW
  WHEN (OLD.retention_days IS DISTINCT FROM NEW.retention_days)
  EXECUTE FUNCTION public.set_file_expires_at();

-- Add comment for documentation
COMMENT ON VIEW public.files_cleanup_candidates IS 
  'View showing files eligible for cleanup: deleted files past 7-day grace period or expired files';

COMMENT ON FUNCTION public.set_file_expires_at() IS 
  'Automatically sets expires_at based on retention_days when a file is inserted or retention_days is updated';