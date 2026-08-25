CREATE OR REPLACE FUNCTION public.get_weekly_report_audit(
  p_project_id uuid DEFAULT NULL,
  p_week_number integer DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_only_empty boolean DEFAULT false,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  version_id uuid,
  report_id uuid,
  project_id uuid,
  project_name text,
  week_number integer,
  version integer,
  restored_from_version integer,
  created_at timestamptz,
  author_id uuid,
  author_name text,
  author_email text,
  gallery_count integer,
  summary_chars integer,
  activities_count integer,
  risks_count integer,
  payload_bytes integer,
  is_empty boolean,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_staff(auth.uid())) THEN
    RAISE EXCEPTION 'Acesso restrito à equipe interna';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      v.id,
      v.report_id,
      v.project_id,
      COALESCE(p.name, 'Obra removida') AS project_name,
      v.week_number,
      v.version,
      v.restored_from_version,
      v.created_at,
      v.created_by,
      up.nome AS author_name,
      up.email AS author_email,
      COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(v.data->'gallery') = 'array' THEN v.data->'gallery' END), 0) AS gallery_count,
      COALESCE(length(v.data->>'executiveSummary'), 0) AS summary_chars,
      COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(v.data->'activities') = 'array' THEN v.data->'activities' END), 0) AS activities_count,
      COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(v.data->'risksAndIssues') = 'array' THEN v.data->'risksAndIssues' END), 0) AS risks_count,
      COALESCE(length(v.data::text), 0) AS payload_bytes
    FROM public.weekly_report_versions v
    LEFT JOIN public.projects p ON p.id = v.project_id
    LEFT JOIN public.users_profile up ON up.id = v.created_by
    WHERE (p_project_id IS NULL OR v.project_id = p_project_id)
      AND (p_week_number IS NULL OR v.week_number = p_week_number)
      AND (
        p_search IS NULL OR p_search = ''
        OR p.name ILIKE '%' || p_search || '%'
        OR up.nome ILIKE '%' || p_search || '%'
        OR up.email ILIKE '%' || p_search || '%'
      )
  ),
  flagged AS (
    SELECT b.*,
      (b.gallery_count = 0 AND b.summary_chars = 0 AND b.activities_count = 0) AS is_empty
    FROM base b
  ),
  filtered AS (
    SELECT f.* FROM flagged f WHERE (NOT p_only_empty) OR f.is_empty
  )
  SELECT
    f.id,
    f.report_id,
    f.project_id,
    f.project_name,
    f.week_number,
    f.version,
    f.restored_from_version,
    f.created_at,
    f.created_by,
    f.author_name,
    f.author_email,
    f.gallery_count,
    f.summary_chars,
    f.activities_count,
    f.risks_count,
    f.payload_bytes,
    f.is_empty,
    (SELECT count(*) FROM filtered) AS total_count
  FROM filtered f
  ORDER BY f.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
  OFFSET GREATEST(0, COALESCE(p_offset, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.get_weekly_report_audit(uuid, integer, text, boolean, integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_weekly_report_audit(uuid, integer, text, boolean, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_weekly_report_audit(uuid, integer, text, boolean, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.get_weekly_report_audit_payload(p_version_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload jsonb;
BEGIN
  IF NOT (public.is_staff(auth.uid())) THEN
    RAISE EXCEPTION 'Acesso restrito à equipe interna';
  END IF;

  SELECT v.data INTO v_payload
  FROM public.weekly_report_versions v
  WHERE v.id = p_version_id;

  RETURN v_payload;
END;
$$;

REVOKE ALL ON FUNCTION public.get_weekly_report_audit_payload(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_weekly_report_audit_payload(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_weekly_report_audit_payload(uuid) TO service_role;

CREATE INDEX IF NOT EXISTS idx_weekly_report_versions_created_at
  ON public.weekly_report_versions (created_at DESC);
