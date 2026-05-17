-- ============================================================
-- Security hardening: remove legacy PII columns from projects
-- and tighten realtime.messages subscription policy
-- ============================================================

-- 1) Backfill any remaining PII rows into project_customers
INSERT INTO public.project_customers (project_id, customer_email, customer_name, customer_phone)
SELECT
  p.id,
  lower(NULLIF(btrim(p.client_email),'')),
  COALESCE(NULLIF(btrim(p.client_name),''), 'Cliente'),
  NULLIF(btrim(p.client_phone),'')
FROM public.projects p
WHERE NULLIF(btrim(p.client_email),'') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.project_customers pc
    WHERE pc.project_id = p.id
      AND lower(pc.customer_email) = lower(btrim(p.client_email))
  )
ON CONFLICT (project_id, customer_email) DO NOTHING;

-- 2) Drop legacy PII columns from projects.
ALTER TABLE public.projects DROP COLUMN IF EXISTS client_name;
ALTER TABLE public.projects DROP COLUMN IF EXISTS client_email;
ALTER TABLE public.projects DROP COLUMN IF EXISTS client_phone;

-- 3) Tighten Realtime subscription policy.
DROP POLICY IF EXISTS "Authenticated users can receive realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Users can subscribe only to topics they own" ON realtime.messages;
DROP POLICY IF EXISTS "Users can broadcast only to topics they own" ON realtime.messages;

CREATE POLICY "Users can subscribe only to topics they own"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() = 'notifications-' || auth.uid()::text)
  OR (
    realtime.topic() LIKE 'project_activities:%'
    AND public.has_project_access(
      auth.uid(),
      NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
    )
  )
  OR (
    realtime.topic() LIKE 'stage-chat-%'
    AND EXISTS (
      SELECT 1
      FROM public.journey_stages js
      WHERE js.id::text = substring(realtime.topic() FROM 'stage-chat-(.+)$')
        AND public.has_project_access(auth.uid(), js.project_id)
    )
  )
);

CREATE POLICY "Users can broadcast only to topics they own"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (realtime.topic() = 'notifications-' || auth.uid()::text)
  OR (
    realtime.topic() LIKE 'project_activities:%'
    AND public.has_project_access(
      auth.uid(),
      NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
    )
  )
  OR (
    realtime.topic() LIKE 'stage-chat-%'
    AND EXISTS (
      SELECT 1
      FROM public.journey_stages js
      WHERE js.id::text = substring(realtime.topic() FROM 'stage-chat-(.+)$')
        AND public.has_project_access(auth.uid(), js.project_id)
    )
  )
);