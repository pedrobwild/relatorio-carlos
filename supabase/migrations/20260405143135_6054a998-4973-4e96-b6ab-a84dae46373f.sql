-- Integration sync log for bidirectional supplier sync
CREATE TABLE public.integration_sync_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_system TEXT NOT NULL,
  target_system TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  target_id UUID,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB,
  error_message TEXT,
  attempts INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ,
  UNIQUE(source_system, entity_type, source_id)
);

-- Enable RLS
ALTER TABLE public.integration_sync_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view sync logs
CREATE POLICY "Admins can view sync logs"
  ON public.integration_sync_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role (edge functions) can do everything via SECURITY DEFINER functions
-- No direct INSERT/UPDATE/DELETE policies for regular users

-- Index for lookups
CREATE INDEX idx_sync_log_source ON public.integration_sync_log (source_system, entity_type, source_id);
CREATE INDEX idx_sync_log_status ON public.integration_sync_log (sync_status) WHERE sync_status IN ('pending', 'failed');