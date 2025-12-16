-- ============================================
-- Optimized Views and RPCs for Heavy Screens
-- ============================================

-- 1. Project Dashboard Summary View
-- Returns project with counts and recent activity in one query
CREATE OR REPLACE VIEW public.project_dashboard_summary AS
SELECT 
  p.id as project_id,
  p.name,
  p.status,
  p.planned_start_date,
  p.planned_end_date,
  p.actual_start_date,
  p.actual_end_date,
  p.contract_value,
  p.org_id,
  -- Pending items counts
  (SELECT COUNT(*) FROM public.pending_items pi 
   WHERE pi.project_id = p.id AND pi.status = 'pending') as pending_count,
  (SELECT COUNT(*) FROM public.pending_items pi 
   WHERE pi.project_id = p.id AND pi.status = 'pending' 
   AND pi.due_date < CURRENT_DATE) as overdue_count,
  -- Documents counts
  (SELECT COUNT(*) FROM public.project_documents pd 
   WHERE pd.project_id = p.id AND pd.parent_document_id IS NULL) as documents_count,
  (SELECT COUNT(*) FROM public.project_documents pd 
   WHERE pd.project_id = p.id AND pd.status = 'pending' 
   AND pd.parent_document_id IS NULL) as pending_documents_count,
  -- Formalizations counts
  (SELECT COUNT(*) FROM public.formalizations f 
   WHERE f.project_id = p.id) as formalizations_count,
  (SELECT COUNT(*) FROM public.formalizations f 
   WHERE f.project_id = p.id AND f.status = 'pending_signatures') as pending_signatures_count,
  -- Financial summary
  (SELECT COALESCE(SUM(amount), 0) FROM public.project_payments pp 
   WHERE pp.project_id = p.id) as total_payments,
  (SELECT COALESCE(SUM(amount), 0) FROM public.project_payments pp 
   WHERE pp.project_id = p.id AND pp.paid_at IS NOT NULL) as paid_amount,
  -- Last activity
  (SELECT MAX(created_at) FROM public.domain_events de 
   WHERE de.project_id = p.id) as last_activity_at
FROM public.projects p;

-- RLS for project_dashboard_summary
ALTER VIEW public.project_dashboard_summary SET (security_invoker = true);

-- 2. Pending Items with Context RPC
-- Returns pending items enriched with reference details
CREATE OR REPLACE FUNCTION public.get_pending_items_with_context(
  p_project_id uuid DEFAULT NULL,
  p_include_completed boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  project_id uuid,
  project_name text,
  customer_org_id uuid,
  type text,
  title text,
  description text,
  due_date date,
  status text,
  amount numeric,
  options jsonb,
  impact text,
  action_url text,
  reference_type text,
  reference_id uuid,
  reference_title text,
  reference_status text,
  created_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid,
  resolver_name text,
  resolution_notes text,
  days_overdue integer,
  urgency_level text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    pi.id,
    pi.project_id,
    p.name as project_name,
    pi.customer_org_id,
    pi.type::text,
    pi.title,
    pi.description,
    pi.due_date,
    pi.status::text,
    pi.amount,
    pi.options,
    pi.impact,
    pi.action_url,
    pi.reference_type,
    pi.reference_id,
    -- Get reference title based on type
    CASE 
      WHEN pi.reference_type = 'formalization' THEN (SELECT f.title FROM formalizations f WHERE f.id = pi.reference_id)
      WHEN pi.reference_type = 'document' THEN (SELECT pd.name FROM project_documents pd WHERE pd.id = pi.reference_id)
      WHEN pi.reference_type = 'payment' THEN (SELECT pp.description FROM project_payments pp WHERE pp.id = pi.reference_id)
      ELSE NULL
    END as reference_title,
    -- Get reference status based on type
    CASE 
      WHEN pi.reference_type = 'formalization' THEN (SELECT f.status::text FROM formalizations f WHERE f.id = pi.reference_id)
      WHEN pi.reference_type = 'document' THEN (SELECT pd.status FROM project_documents pd WHERE pd.id = pi.reference_id)
      ELSE NULL
    END as reference_status,
    pi.created_at,
    pi.resolved_at,
    pi.resolved_by,
    (SELECT pr.display_name FROM profiles pr WHERE pr.user_id = pi.resolved_by) as resolver_name,
    pi.resolution_notes,
    -- Calculate days overdue
    CASE 
      WHEN pi.due_date < CURRENT_DATE AND pi.status = 'pending' 
      THEN (CURRENT_DATE - pi.due_date)::integer
      ELSE 0
    END as days_overdue,
    -- Urgency level
    CASE 
      WHEN pi.due_date < CURRENT_DATE THEN 'overdue'
      WHEN pi.due_date <= CURRENT_DATE + INTERVAL '2 days' THEN 'urgent'
      WHEN pi.due_date <= CURRENT_DATE + INTERVAL '5 days' THEN 'approaching'
      ELSE 'normal'
    END as urgency_level
  FROM pending_items pi
  JOIN projects p ON p.id = pi.project_id
  WHERE 
    (p_project_id IS NULL OR pi.project_id = p_project_id)
    AND (p_include_completed OR pi.status = 'pending')
    AND user_belongs_to_org(auth.uid(), pi.customer_org_id)
  ORDER BY 
    CASE pi.status WHEN 'pending' THEN 0 ELSE 1 END,
    CASE 
      WHEN pi.due_date < CURRENT_DATE THEN 0
      WHEN pi.due_date <= CURRENT_DATE + INTERVAL '2 days' THEN 1
      ELSE 2
    END,
    pi.due_date ASC NULLS LAST;
$$;

-- 3. Project Activity Timeline RPC
-- Returns recent events for a project with actor details
CREATE OR REPLACE FUNCTION public.get_project_activity_timeline(
  p_project_id uuid,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  event_type text,
  entity_type text,
  entity_id uuid,
  entity_title text,
  payload jsonb,
  actor_user_id uuid,
  actor_name text,
  actor_email text,
  ip_address text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    de.id,
    de.event_type,
    de.entity_type,
    de.entity_id,
    -- Get entity title based on type
    CASE 
      WHEN de.entity_type = 'formalization' THEN (SELECT f.title FROM formalizations f WHERE f.id = de.entity_id)
      WHEN de.entity_type = 'document' THEN (SELECT pd.name FROM project_documents pd WHERE pd.id = de.entity_id)
      WHEN de.entity_type = 'pending_item' THEN (SELECT pi.title FROM pending_items pi WHERE pi.id = de.entity_id)
      ELSE de.payload->>'title'
    END as entity_title,
    de.payload,
    de.actor_user_id,
    pr.display_name as actor_name,
    pr.email as actor_email,
    de.ip_address,
    de.created_at
  FROM domain_events de
  LEFT JOIN profiles pr ON pr.user_id = de.actor_user_id
  WHERE de.project_id = p_project_id
    AND (is_project_member(auth.uid(), p_project_id) OR has_role(auth.uid(), 'admin'))
  ORDER BY de.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- 4. Formalization Complete Details RPC
-- Returns formalization with all related data in one call
CREATE OR REPLACE FUNCTION public.get_formalization_complete(p_formalization_id uuid)
RETURNS TABLE (
  -- Main formalization fields
  id uuid,
  customer_org_id uuid,
  project_id uuid,
  project_name text,
  unit_id uuid,
  type text,
  status text,
  title text,
  summary text,
  body_md text,
  data jsonb,
  locked_at timestamptz,
  locked_hash text,
  created_at timestamptz,
  updated_at timestamptz,
  created_by uuid,
  creator_name text,
  -- Aggregated related data
  parties jsonb,
  acknowledgements jsonb,
  evidence_links jsonb,
  attachments jsonb,
  recent_events jsonb,
  -- Signature progress
  total_parties integer,
  signed_parties integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    f.id,
    f.customer_org_id,
    f.project_id,
    p.name as project_name,
    f.unit_id,
    f.type::text,
    f.status::text,
    f.title,
    f.summary,
    f.body_md,
    f.data,
    f.locked_at,
    f.locked_hash,
    f.created_at,
    f.updated_at,
    f.created_by,
    (SELECT pr.display_name FROM profiles pr WHERE pr.user_id = f.created_by) as creator_name,
    -- Parties with acknowledgement status
    (SELECT jsonb_agg(jsonb_build_object(
      'id', fp.id,
      'party_type', fp.party_type,
      'display_name', fp.display_name,
      'email', fp.email,
      'role_label', fp.role_label,
      'must_sign', fp.must_sign,
      'acknowledged', EXISTS(SELECT 1 FROM formalization_acknowledgements fa WHERE fa.party_id = fp.id),
      'acknowledged_at', (SELECT fa.acknowledged_at FROM formalization_acknowledgements fa WHERE fa.party_id = fp.id)
    ) ORDER BY fp.party_type, fp.created_at)
    FROM formalization_parties fp WHERE fp.formalization_id = f.id) as parties,
    -- Acknowledgements
    (SELECT jsonb_agg(jsonb_build_object(
      'id', fa.id,
      'party_id', fa.party_id,
      'acknowledged_at', fa.acknowledged_at,
      'acknowledged_by_email', fa.acknowledged_by_email,
      'ip_address', fa.ip_address,
      'signature_hash', fa.signature_hash
    ) ORDER BY fa.acknowledged_at)
    FROM formalization_acknowledgements fa WHERE fa.formalization_id = f.id) as acknowledgements,
    -- Evidence links
    (SELECT jsonb_agg(jsonb_build_object(
      'id', fel.id,
      'kind', fel.kind,
      'url', fel.url,
      'description', fel.description,
      'created_at', fel.created_at
    ) ORDER BY fel.created_at DESC)
    FROM formalization_evidence_links fel WHERE fel.formalization_id = f.id) as evidence_links,
    -- Attachments
    (SELECT jsonb_agg(jsonb_build_object(
      'id', fat.id,
      'original_filename', fat.original_filename,
      'mime_type', fat.mime_type,
      'size_bytes', fat.size_bytes,
      'storage_path', fat.storage_path,
      'created_at', fat.created_at
    ) ORDER BY fat.created_at DESC)
    FROM formalization_attachments fat WHERE fat.formalization_id = f.id) as attachments,
    -- Recent events (last 10)
    (SELECT jsonb_agg(jsonb_build_object(
      'id', fe.id,
      'event_type', fe.event_type,
      'meta', fe.meta,
      'actor_user_id', fe.actor_user_id,
      'actor_name', (SELECT pr.display_name FROM profiles pr WHERE pr.user_id = fe.actor_user_id),
      'created_at', fe.created_at
    ) ORDER BY fe.created_at DESC)
    FROM (SELECT * FROM formalization_events fe2 WHERE fe2.formalization_id = f.id ORDER BY fe2.created_at DESC LIMIT 10) fe) as recent_events,
    -- Signature progress
    (SELECT COUNT(*)::integer FROM formalization_parties fp WHERE fp.formalization_id = f.id AND fp.must_sign = true) as total_parties,
    (SELECT COUNT(*)::integer FROM formalization_parties fp 
     WHERE fp.formalization_id = f.id AND fp.must_sign = true
     AND EXISTS(SELECT 1 FROM formalization_acknowledgements fa WHERE fa.party_id = fp.id)) as signed_parties
  FROM formalizations f
  LEFT JOIN projects p ON p.id = f.project_id
  WHERE f.id = p_formalization_id
    AND user_belongs_to_org(auth.uid(), f.customer_org_id);
$$;

-- 5. User Projects Summary RPC
-- Returns all projects user has access to with summary stats
CREATE OR REPLACE FUNCTION public.get_user_projects_summary()
RETURNS TABLE (
  id uuid,
  name text,
  status text,
  org_id uuid,
  org_name text,
  planned_start_date date,
  planned_end_date date,
  actual_start_date date,
  actual_end_date date,
  contract_value numeric,
  user_role text,
  pending_count bigint,
  overdue_count bigint,
  unsigned_formalizations bigint,
  pending_documents bigint,
  progress_percentage numeric,
  last_activity_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.name,
    p.status,
    p.org_id,
    o.name as org_name,
    p.planned_start_date,
    p.planned_end_date,
    p.actual_start_date,
    p.actual_end_date,
    p.contract_value,
    pm.role::text as user_role,
    -- Pending items
    (SELECT COUNT(*) FROM pending_items pi 
     WHERE pi.project_id = p.id AND pi.status = 'pending') as pending_count,
    (SELECT COUNT(*) FROM pending_items pi 
     WHERE pi.project_id = p.id AND pi.status = 'pending' 
     AND pi.due_date < CURRENT_DATE) as overdue_count,
    -- Unsigned formalizations
    (SELECT COUNT(*) FROM formalizations f 
     WHERE f.project_id = p.id AND f.status = 'pending_signatures') as unsigned_formalizations,
    -- Pending documents
    (SELECT COUNT(*) FROM project_documents pd 
     WHERE pd.project_id = p.id AND pd.status = 'pending' 
     AND pd.parent_document_id IS NULL) as pending_documents,
    -- Progress (based on timeline)
    CASE 
      WHEN p.actual_end_date IS NOT NULL THEN 100
      WHEN p.actual_start_date IS NULL THEN 0
      ELSE LEAST(100, ROUND(
        (CURRENT_DATE - p.actual_start_date)::numeric / 
        NULLIF((p.planned_end_date - p.actual_start_date)::numeric, 0) * 100
      , 1))
    END as progress_percentage,
    -- Last activity
    (SELECT MAX(created_at) FROM domain_events de 
     WHERE de.project_id = p.id) as last_activity_at
  FROM projects p
  JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = auth.uid()
  LEFT JOIN orgs o ON o.id = p.org_id
  ORDER BY 
    CASE p.status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
    p.planned_end_date ASC;
$$;