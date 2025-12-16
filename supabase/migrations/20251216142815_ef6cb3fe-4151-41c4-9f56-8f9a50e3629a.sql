-- ============================================
-- Performance Indexes & Observability System
-- ============================================

-- 1. PERFORMANCE INDEXES

-- Domain events indexes for timeline queries
CREATE INDEX IF NOT EXISTS idx_domain_events_project_created 
  ON public.domain_events (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_domain_events_org_created 
  ON public.domain_events (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_domain_events_entity_lookup 
  ON public.domain_events (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_domain_events_event_type 
  ON public.domain_events (event_type, created_at DESC);

-- Pending items indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_pending_items_status_due 
  ON public.pending_items (status, due_date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_pending_items_org_status 
  ON public.pending_items (customer_org_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_pending_items_reference 
  ON public.pending_items (reference_type, reference_id) WHERE reference_id IS NOT NULL;

-- Formalizations indexes
CREATE INDEX IF NOT EXISTS idx_formalizations_project_status 
  ON public.formalizations (project_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_formalizations_org_status 
  ON public.formalizations (customer_org_id, status, last_activity_at DESC);

-- Project documents indexes
CREATE INDEX IF NOT EXISTS idx_documents_project_type 
  ON public.project_documents (project_id, document_type, version DESC);
CREATE INDEX IF NOT EXISTS idx_documents_status_created 
  ON public.project_documents (status, created_at DESC) WHERE status = 'pending';

-- Project payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_project_due 
  ON public.project_payments (project_id, due_date);
CREATE INDEX IF NOT EXISTS idx_payments_unpaid 
  ON public.project_payments (project_id, due_date) WHERE paid_at IS NULL;

-- Project members indexes
CREATE INDEX IF NOT EXISTS idx_members_user_role 
  ON public.project_members (user_id, role);

-- Formalization parties/acknowledgements indexes
CREATE INDEX IF NOT EXISTS idx_parties_formalization 
  ON public.formalization_parties (formalization_id, party_type);
CREATE INDEX IF NOT EXISTS idx_acknowledgements_party 
  ON public.formalization_acknowledgements (party_id);

-- GIN index on JSONB columns for payload filtering
CREATE INDEX IF NOT EXISTS idx_domain_events_payload_gin 
  ON public.domain_events USING GIN (payload);
CREATE INDEX IF NOT EXISTS idx_formalizations_data_gin 
  ON public.formalizations USING GIN (data);
CREATE INDEX IF NOT EXISTS idx_pending_items_options_gin 
  ON public.pending_items USING GIN (options);

-- 2. OBSERVABILITY SYSTEM

-- System errors table for edge function and critical errors
CREATE TABLE IF NOT EXISTS public.system_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Error identification
  error_code text NOT NULL,
  error_message text NOT NULL,
  error_stack text,
  
  -- Context
  source text NOT NULL, -- 'edge_function', 'rpc', 'trigger', 'client'
  function_name text,
  
  -- Correlation
  request_id uuid,
  user_id uuid,
  org_id uuid,
  project_id uuid,
  
  -- Request context
  request_path text,
  request_method text,
  request_headers jsonb DEFAULT '{}'::jsonb,
  request_body jsonb DEFAULT '{}'::jsonb,
  
  -- Environment
  environment text DEFAULT 'production',
  
  -- Structured metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Resolution tracking
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_notes text
);

-- Indexes for error queries
CREATE INDEX IF NOT EXISTS idx_system_errors_created 
  ON public.system_errors (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_errors_source_code 
  ON public.system_errors (source, error_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_errors_request 
  ON public.system_errors (request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_system_errors_user 
  ON public.system_errors (user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_system_errors_unresolved 
  ON public.system_errors (created_at DESC) WHERE resolved_at IS NULL;

-- Enable RLS
ALTER TABLE public.system_errors ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage system errors
CREATE POLICY "Admins can view system errors"
  ON public.system_errors FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert errors"
  ON public.system_errors FOR INSERT
  WITH CHECK (true); -- Edge functions use service role

CREATE POLICY "Admins can update errors"
  ON public.system_errors FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- Function to log system errors (callable from edge functions)
CREATE OR REPLACE FUNCTION public.log_system_error(
  p_error_code text,
  p_error_message text,
  p_source text,
  p_function_name text DEFAULT NULL,
  p_request_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_org_id uuid DEFAULT NULL,
  p_project_id uuid DEFAULT NULL,
  p_error_stack text DEFAULT NULL,
  p_request_path text DEFAULT NULL,
  p_request_method text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_error_id uuid;
BEGIN
  INSERT INTO public.system_errors (
    error_code,
    error_message,
    error_stack,
    source,
    function_name,
    request_id,
    user_id,
    org_id,
    project_id,
    request_path,
    request_method,
    metadata
  ) VALUES (
    p_error_code,
    p_error_message,
    p_error_stack,
    p_source,
    p_function_name,
    p_request_id,
    p_user_id,
    p_org_id,
    p_project_id,
    p_request_path,
    p_request_method,
    p_metadata
  )
  RETURNING id INTO v_error_id;
  
  RETURN v_error_id;
END;
$$;

-- View for error statistics (for dashboards)
CREATE OR REPLACE VIEW public.system_error_stats AS
SELECT 
  date_trunc('hour', created_at) as hour,
  source,
  error_code,
  COUNT(*) as error_count,
  COUNT(DISTINCT user_id) as affected_users,
  COUNT(DISTINCT request_id) as affected_requests
FROM public.system_errors
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY date_trunc('hour', created_at), source, error_code
ORDER BY hour DESC, error_count DESC;

ALTER VIEW public.system_error_stats SET (security_invoker = true);

-- Function to get error rate alerts
CREATE OR REPLACE FUNCTION public.check_error_rate_alerts(
  p_threshold_per_hour integer DEFAULT 10,
  p_lookback_hours integer DEFAULT 1
)
RETURNS TABLE (
  source text,
  error_code text,
  error_count bigint,
  first_occurrence timestamptz,
  last_occurrence timestamptz,
  sample_message text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    source,
    error_code,
    COUNT(*) as error_count,
    MIN(created_at) as first_occurrence,
    MAX(created_at) as last_occurrence,
    (SELECT error_message FROM system_errors se2 
     WHERE se2.source = se.source AND se2.error_code = se.error_code 
     ORDER BY created_at DESC LIMIT 1) as sample_message
  FROM system_errors se
  WHERE created_at > NOW() - (p_lookback_hours || ' hours')::interval
  GROUP BY source, error_code
  HAVING COUNT(*) >= p_threshold_per_hour
  ORDER BY error_count DESC;
$$;