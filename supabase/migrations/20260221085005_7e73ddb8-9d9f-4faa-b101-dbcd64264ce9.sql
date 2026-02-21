
-- Fix SECURITY DEFINER views → SECURITY INVOKER (drop + recreate for column changes)

-- 1. system_error_stats - must drop first due to column name changes
DROP VIEW IF EXISTS public.system_error_stats;
CREATE VIEW public.system_error_stats
WITH (security_invoker = on)
AS
SELECT 
  source,
  error_code,
  count(*) AS total_count,
  count(*) FILTER (WHERE created_at > now() - interval '1 hour') AS last_hour,
  count(*) FILTER (WHERE created_at > now() - interval '24 hours') AS last_24h,
  max(created_at) AS last_occurrence,
  min(created_at) AS first_occurrence
FROM system_errors
GROUP BY source, error_code
ORDER BY last_hour DESC, total_count DESC;

-- 2. formalizations_public_customer (columns match, just add security_invoker)
DROP VIEW IF EXISTS public.formalizations_public_customer;
CREATE VIEW public.formalizations_public_customer
WITH (security_invoker = on)
AS
SELECT 
  f.id,
  f.customer_org_id,
  f.project_id,
  f.unit_id,
  f.type,
  f.title,
  f.summary,
  f.body_md,
  f.data,
  f.status,
  f.locked_at,
  f.locked_hash,
  f.last_activity_at,
  f.created_at,
  f.updated_at,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', p.id, 'party_type', p.party_type, 'display_name', p.display_name,
      'email', p.email, 'role_label', p.role_label, 'must_sign', p.must_sign,
      'has_signed', EXISTS(SELECT 1 FROM formalization_acknowledgements a WHERE a.party_id = p.id AND a.acknowledged = true)
    ) ORDER BY p.party_type, p.created_at)
    FROM formalization_parties p WHERE p.formalization_id = f.id
  ), '[]'::jsonb) AS parties,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', a.id, 'party_id', a.party_id, 'acknowledged', a.acknowledged,
      'acknowledged_at', a.acknowledged_at, 'acknowledged_by_user_id', a.acknowledged_by_user_id,
      'acknowledged_by_email', a.acknowledged_by_email, 'signature_text', a.signature_text,
      'signature_hash', a.signature_hash, 'ip_address', a.ip_address, 'user_agent', a.user_agent
    ) ORDER BY a.acknowledged_at)
    FROM formalization_acknowledgements a WHERE a.formalization_id = f.id
  ), '[]'::jsonb) AS acknowledgements,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', e.id, 'kind', e.kind, 'url', e.url, 'description', e.description, 'created_at', e.created_at
    ) ORDER BY e.created_at)
    FROM formalization_evidence_links e WHERE e.formalization_id = f.id
  ), '[]'::jsonb) AS evidence_links,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', att.id, 'original_filename', att.original_filename, 'mime_type', att.mime_type,
      'size_bytes', att.size_bytes, 'storage_path', att.storage_path, 'storage_bucket', att.storage_bucket,
      'created_at', att.created_at
    ) ORDER BY att.created_at)
    FROM formalization_attachments att WHERE att.formalization_id = f.id
  ), '[]'::jsonb) AS attachments,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', ev.id, 'event_type', ev.event_type, 'actor_user_id', ev.actor_user_id,
      'meta', ev.meta, 'created_at', ev.created_at
    ) ORDER BY ev.created_at)
    FROM formalization_events ev WHERE ev.formalization_id = f.id
  ), '[]'::jsonb) AS events,
  (SELECT count(*) FROM formalization_parties p WHERE p.formalization_id = f.id AND p.must_sign = true) AS parties_total,
  (SELECT count(*) FROM formalization_acknowledgements a 
   JOIN formalization_parties p ON p.id = a.party_id 
   WHERE a.formalization_id = f.id AND a.acknowledged = true AND p.must_sign = true) AS parties_signed
FROM formalizations f;

-- 3. project_dashboard_summary
DROP VIEW IF EXISTS public.project_dashboard_summary;
CREATE VIEW public.project_dashboard_summary
WITH (security_invoker = on)
AS
SELECT 
  p.id AS project_id,
  p.name,
  p.status,
  p.planned_start_date,
  p.planned_end_date,
  p.actual_start_date,
  p.actual_end_date,
  p.contract_value,
  p.org_id,
  (SELECT count(*) FROM pending_items pi WHERE pi.project_id = p.id AND pi.status = 'pending') AS pending_count,
  (SELECT count(*) FROM pending_items pi WHERE pi.project_id = p.id AND pi.status = 'pending' AND pi.due_date < CURRENT_DATE) AS overdue_count,
  (SELECT count(*) FROM project_documents pd WHERE pd.project_id = p.id AND pd.parent_document_id IS NULL) AS documents_count,
  (SELECT count(*) FROM project_documents pd WHERE pd.project_id = p.id AND pd.status = 'pending' AND pd.parent_document_id IS NULL) AS pending_documents_count,
  (SELECT count(*) FROM formalizations f WHERE f.project_id = p.id) AS formalizations_count,
  (SELECT count(*) FROM formalizations f WHERE f.project_id = p.id AND f.status = 'pending_signatures') AS pending_signatures_count,
  (SELECT COALESCE(sum(pp.amount), 0) FROM project_payments pp WHERE pp.project_id = p.id) AS total_payments,
  (SELECT COALESCE(sum(pp.amount), 0) FROM project_payments pp WHERE pp.project_id = p.id AND pp.paid_at IS NOT NULL) AS paid_amount,
  (SELECT max(de.created_at) FROM domain_events de WHERE de.project_id = p.id) AS last_activity_at
FROM projects p;

-- 4. files_summary
DROP VIEW IF EXISTS public.files_summary;
CREATE VIEW public.files_summary
WITH (security_invoker = on)
AS
SELECT 
  f.project_id,
  f.bucket,
  f.status,
  count(*) AS file_count,
  COALESCE(sum(f.size_bytes), 0) AS total_size_bytes
FROM files f
GROUP BY f.project_id, f.bucket, f.status;

-- 5. files_cleanup_candidates
DROP VIEW IF EXISTS public.files_cleanup_candidates;
CREATE VIEW public.files_cleanup_candidates
WITH (security_invoker = on)
AS
SELECT 
  f.id,
  f.original_name,
  f.storage_path,
  f.bucket,
  f.size_bytes,
  f.status,
  f.deleted_at,
  f.expires_at,
  f.project_id,
  f.owner_id
FROM files f
WHERE 
  (f.status = 'deleted' AND f.deleted_at < now() - interval '7 days')
  OR (f.expires_at IS NOT NULL AND f.expires_at < now());

-- SEC-03: Enable RLS on project_customers
ALTER TABLE IF EXISTS public.project_customers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_customers' AND policyname = 'Staff can view all project_customers') THEN
    CREATE POLICY "Staff can view all project_customers"
      ON public.project_customers FOR SELECT
      USING (public.is_staff(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_customers' AND policyname = 'Customers can view own project_customers') THEN
    CREATE POLICY "Customers can view own project_customers"
      ON public.project_customers FOR SELECT
      USING (customer_user_id = auth.uid());
  END IF;
END $$;
