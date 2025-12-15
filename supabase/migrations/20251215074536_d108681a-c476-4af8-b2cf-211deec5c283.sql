-- Drop the security definer view and recreate with security invoker
DROP VIEW IF EXISTS public.formalizations_public_customer;

-- Recreate view with security invoker (uses caller's permissions)
CREATE VIEW public.formalizations_public_customer 
WITH (security_invoker = true)
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
  -- Aggregated parties
  COALESCE(
    (
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id,
        'party_type', p.party_type,
        'display_name', p.display_name,
        'role_label', p.role_label,
        'must_sign', p.must_sign,
        'has_signed', EXISTS (
          SELECT 1 FROM public.formalization_acknowledgements a 
          WHERE a.party_id = p.id AND a.acknowledged = true
        )
      ) ORDER BY p.party_type, p.created_at)
      FROM public.formalization_parties p
      WHERE p.formalization_id = f.id
    ),
    '[]'::jsonb
  ) AS parties,
  -- Aggregated acknowledgements (without sensitive data like IP)
  COALESCE(
    (
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id,
        'party_id', a.party_id,
        'acknowledged', a.acknowledged,
        'acknowledged_at', a.acknowledged_at,
        'signature_text', a.signature_text
      ) ORDER BY a.acknowledged_at)
      FROM public.formalization_acknowledgements a
      WHERE a.formalization_id = f.id
    ),
    '[]'::jsonb
  ) AS acknowledgements,
  -- Aggregated evidence links
  COALESCE(
    (
      SELECT jsonb_agg(jsonb_build_object(
        'id', e.id,
        'kind', e.kind,
        'url', e.url,
        'description', e.description,
        'created_at', e.created_at
      ) ORDER BY e.created_at)
      FROM public.formalization_evidence_links e
      WHERE e.formalization_id = f.id
    ),
    '[]'::jsonb
  ) AS evidence_links,
  -- Aggregated attachments
  COALESCE(
    (
      SELECT jsonb_agg(jsonb_build_object(
        'id', att.id,
        'original_filename', att.original_filename,
        'mime_type', att.mime_type,
        'size_bytes', att.size_bytes,
        'created_at', att.created_at
      ) ORDER BY att.created_at)
      FROM public.formalization_attachments att
      WHERE att.formalization_id = f.id
    ),
    '[]'::jsonb
  ) AS attachments,
  -- Aggregated events
  COALESCE(
    (
      SELECT jsonb_agg(jsonb_build_object(
        'id', ev.id,
        'event_type', ev.event_type,
        'meta', ev.meta,
        'created_at', ev.created_at
      ) ORDER BY ev.created_at)
      FROM public.formalization_events ev
      WHERE ev.formalization_id = f.id
    ),
    '[]'::jsonb
  ) AS events,
  -- Signature progress
  (
    SELECT COUNT(*) 
    FROM public.formalization_parties p
    WHERE p.formalization_id = f.id AND p.must_sign = true
  ) AS parties_total,
  (
    SELECT COUNT(*) 
    FROM public.formalization_acknowledgements a
    JOIN public.formalization_parties p ON p.id = a.party_id
    WHERE a.formalization_id = f.id AND a.acknowledged = true AND p.must_sign = true
  ) AS parties_signed
FROM public.formalizations f;

-- Grant access to the view
GRANT SELECT ON public.formalizations_public_customer TO authenticated;