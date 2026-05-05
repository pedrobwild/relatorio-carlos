ALTER TABLE public.assistant_logs
  ADD COLUMN IF NOT EXISTS answer_length integer,
  ADD COLUMN IF NOT EXISTS finish_reason text,
  ADD COLUMN IF NOT EXISTS truncated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS truncation_reason text;

CREATE INDEX IF NOT EXISTS idx_assistant_logs_truncated
  ON public.assistant_logs (created_at DESC)
  WHERE truncated = true;

CREATE OR REPLACE FUNCTION public.assistant_truncation_stats(hours_back integer DEFAULT 24)
RETURNS TABLE (
  total_responses bigint,
  truncated_count bigint,
  truncation_rate numeric,
  avg_answer_length numeric,
  recent_truncated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::bigint                                        AS total_responses,
    COUNT(*) FILTER (WHERE truncated)::bigint               AS truncated_count,
    CASE WHEN COUNT(*) = 0 THEN 0
         ELSE ROUND((COUNT(*) FILTER (WHERE truncated))::numeric / COUNT(*)::numeric * 100, 2)
    END                                                     AS truncation_rate,
    ROUND(AVG(answer_length)::numeric, 0)                   AS avg_answer_length,
    MAX(created_at) FILTER (WHERE truncated)                AS recent_truncated_at
  FROM public.assistant_logs
  WHERE created_at >= NOW() - (hours_back || ' hours')::interval;
$$;

REVOKE ALL ON FUNCTION public.assistant_truncation_stats(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assistant_truncation_stats(integer) TO authenticated;