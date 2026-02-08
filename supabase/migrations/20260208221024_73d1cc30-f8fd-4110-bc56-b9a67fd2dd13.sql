-- Recriar a view formalizations_public_customer com todos os campos de acknowledgement necessários
DROP VIEW IF EXISTS public.formalizations_public_customer;

CREATE VIEW public.formalizations_public_customer AS
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
  -- Parties with signature status
  COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'party_type', p.party_type,
        'display_name', p.display_name,
        'email', p.email,
        'role_label', p.role_label,
        'must_sign', p.must_sign,
        'has_signed', EXISTS (
          SELECT 1 FROM formalization_acknowledgements a
          WHERE a.party_id = p.id AND a.acknowledged = true
        )
      ) ORDER BY p.party_type, p.created_at
    )
    FROM formalization_parties p
    WHERE p.formalization_id = f.id),
    '[]'::jsonb
  ) AS parties,
  -- Acknowledgements with ALL technical fields for audit trail
  COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'party_id', a.party_id,
        'acknowledged', a.acknowledged,
        'acknowledged_at', a.acknowledged_at,
        'acknowledged_by_user_id', a.acknowledged_by_user_id,
        'acknowledged_by_email', a.acknowledged_by_email,
        'signature_text', a.signature_text,
        'signature_hash', a.signature_hash,
        'ip_address', a.ip_address,
        'user_agent', a.user_agent
      ) ORDER BY a.acknowledged_at
    )
    FROM formalization_acknowledgements a
    WHERE a.formalization_id = f.id),
    '[]'::jsonb
  ) AS acknowledgements,
  -- Evidence links
  COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'kind', e.kind,
        'url', e.url,
        'description', e.description,
        'created_at', e.created_at
      ) ORDER BY e.created_at
    )
    FROM formalization_evidence_links e
    WHERE e.formalization_id = f.id),
    '[]'::jsonb
  ) AS evidence_links,
  -- Attachments
  COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'id', att.id,
        'original_filename', att.original_filename,
        'mime_type', att.mime_type,
        'size_bytes', att.size_bytes,
        'storage_path', att.storage_path,
        'storage_bucket', att.storage_bucket,
        'created_at', att.created_at
      ) ORDER BY att.created_at
    )
    FROM formalization_attachments att
    WHERE att.formalization_id = f.id),
    '[]'::jsonb
  ) AS attachments,
  -- Events
  COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'id', ev.id,
        'event_type', ev.event_type,
        'actor_user_id', ev.actor_user_id,
        'meta', ev.meta,
        'created_at', ev.created_at
      ) ORDER BY ev.created_at
    )
    FROM formalization_events ev
    WHERE ev.formalization_id = f.id),
    '[]'::jsonb
  ) AS events,
  -- Signature progress counters
  (SELECT COUNT(*) FROM formalization_parties p
   WHERE p.formalization_id = f.id AND p.must_sign = true) AS parties_total,
  (SELECT COUNT(*) FROM formalization_acknowledgements a
   JOIN formalization_parties p ON p.id = a.party_id
   WHERE a.formalization_id = f.id AND a.acknowledged = true AND p.must_sign = true) AS parties_signed
FROM formalizations f;