-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_org_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('customer', 'staff', 'manager', 'admin')),
  display_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS - users can view/update their own profile
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (user_id = auth.uid());

-- Security definer function to get user's org and role
CREATE OR REPLACE FUNCTION public.get_user_profile(p_user_id uuid)
RETURNS TABLE(customer_org_id uuid, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.customer_org_id, p.role
  FROM public.profiles p
  WHERE p.user_id = p_user_id
  LIMIT 1;
$$;

-- Check if user belongs to org
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(p_user_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user_id AND customer_org_id = p_org_id
  );
$$;

-- Check if user has staff+ role
CREATE OR REPLACE FUNCTION public.user_is_staff_or_above(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user_id AND role IN ('staff', 'manager', 'admin')
  );
$$;

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.user_is_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user_id AND role = 'admin'
  );
$$;

-- Get user's customer_org_id
CREATE OR REPLACE FUNCTION public.get_user_org_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT customer_org_id FROM public.profiles WHERE user_id = p_user_id LIMIT 1;
$$;

-- Drop existing policies on formalizations
DROP POLICY IF EXISTS "Users can view formalizations they created or are party to" ON public.formalizations;
DROP POLICY IF EXISTS "Users can create formalizations" ON public.formalizations;
DROP POLICY IF EXISTS "Users can update their draft formalizations" ON public.formalizations;

-- FORMALIZATIONS RLS POLICIES

-- SELECT: users can see formalizations in their org
CREATE POLICY "formalizations_select_policy"
  ON public.formalizations FOR SELECT
  USING (
    public.user_belongs_to_org(auth.uid(), customer_org_id)
  );

-- INSERT: 
-- - customer: can insert if created_by=self, org matches, status='draft'
-- - staff+: can insert if org matches
CREATE POLICY "formalizations_insert_policy"
  ON public.formalizations FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND customer_org_id = public.get_user_org_id(auth.uid())
    AND (
      public.user_is_staff_or_above(auth.uid())
      OR status = 'draft'
    )
  );

-- UPDATE:
-- - customer: only if status='draft', locked_at IS NULL, created_by=self
-- - staff+: can update if org matches and (locked_at IS NULL OR only setting status to 'voided' as admin)
-- - after lock: only admin can set status='voided'
CREATE POLICY "formalizations_update_policy"
  ON public.formalizations FOR UPDATE
  USING (
    public.user_belongs_to_org(auth.uid(), customer_org_id)
    AND (
      -- Staff+ can update if not locked
      (public.user_is_staff_or_above(auth.uid()) AND locked_at IS NULL)
      -- Customer can update only their own drafts
      OR (created_by = auth.uid() AND status = 'draft' AND locked_at IS NULL)
      -- Admin can void even after lock
      OR public.user_is_admin(auth.uid())
    )
  );

-- DELETE: only admin can delete
CREATE POLICY "formalizations_delete_policy"
  ON public.formalizations FOR DELETE
  USING (public.user_is_admin(auth.uid()) AND public.user_belongs_to_org(auth.uid(), customer_org_id));


-- Drop existing policies on formalization_parties
DROP POLICY IF EXISTS "Users can view parties of accessible formalizations" ON public.formalization_parties;
DROP POLICY IF EXISTS "Formalization creators can manage parties" ON public.formalization_parties;

-- FORMALIZATION_PARTIES RLS POLICIES

-- SELECT: users in org can see parties
CREATE POLICY "formalization_parties_select_policy"
  ON public.formalization_parties FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.formalizations f
      WHERE f.id = formalization_id
      AND public.user_belongs_to_org(auth.uid(), f.customer_org_id)
    )
  );

-- INSERT: 
-- - customer: only if formalization is draft and created_by=self
-- - staff+: can insert if formalization is not locked
CREATE POLICY "formalization_parties_insert_policy"
  ON public.formalization_parties FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.formalizations f
      WHERE f.id = formalization_id
      AND public.user_belongs_to_org(auth.uid(), f.customer_org_id)
      AND f.locked_at IS NULL
      AND (
        public.user_is_staff_or_above(auth.uid())
        OR (f.created_by = auth.uid() AND f.status = 'draft')
      )
    )
  );

-- UPDATE: same as insert
CREATE POLICY "formalization_parties_update_policy"
  ON public.formalization_parties FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.formalizations f
      WHERE f.id = formalization_id
      AND public.user_belongs_to_org(auth.uid(), f.customer_org_id)
      AND f.locked_at IS NULL
      AND (
        public.user_is_staff_or_above(auth.uid())
        OR (f.created_by = auth.uid() AND f.status = 'draft')
      )
    )
  );

-- DELETE: only staff+ before lock
CREATE POLICY "formalization_parties_delete_policy"
  ON public.formalization_parties FOR DELETE
  USING (
    public.user_is_staff_or_above(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.formalizations f
      WHERE f.id = formalization_id
      AND public.user_belongs_to_org(auth.uid(), f.customer_org_id)
      AND f.locked_at IS NULL
    )
  );


-- Drop existing policies on formalization_acknowledgements
DROP POLICY IF EXISTS "Users can view acknowledgements of accessible formalizations" ON public.formalization_acknowledgements;
DROP POLICY IF EXISTS "Parties can create their own acknowledgements" ON public.formalization_acknowledgements;

-- FORMALIZATION_ACKNOWLEDGEMENTS RLS POLICIES

-- SELECT: users in org can see acknowledgements
CREATE POLICY "formalization_acknowledgements_select_policy"
  ON public.formalization_acknowledgements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.formalizations f
      WHERE f.id = formalization_id
      AND public.user_belongs_to_org(auth.uid(), f.customer_org_id)
    )
  );

-- INSERT: 
-- Customer can sign if:
--   - formalization.status='pending_signatures'
--   - formalization.locked_hash IS NOT NULL
--   - exists party with user_id = auth.uid() OR matching email
-- Staff+ can sign for company party
CREATE POLICY "formalization_acknowledgements_insert_policy"
  ON public.formalization_acknowledgements FOR INSERT
  WITH CHECK (
    acknowledged_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.formalizations f
      WHERE f.id = formalization_id
      AND public.user_belongs_to_org(auth.uid(), f.customer_org_id)
      AND f.status = 'pending_signatures'
      AND f.locked_hash IS NOT NULL
    )
    AND EXISTS (
      SELECT 1 FROM public.formalization_parties p
      WHERE p.id = party_id
      AND p.formalization_id = formalization_id
      AND (
        -- Customer signing their own party
        (p.party_type = 'customer' AND (p.user_id = auth.uid() OR p.email = (SELECT email FROM public.profiles WHERE user_id = auth.uid())))
        -- Staff+ signing company party
        OR (p.party_type = 'company' AND public.user_is_staff_or_above(auth.uid()))
      )
    )
  );

-- No UPDATE/DELETE for acknowledgements (immutable)
CREATE POLICY "formalization_acknowledgements_no_update"
  ON public.formalization_acknowledgements FOR UPDATE
  USING (false);

CREATE POLICY "formalization_acknowledgements_no_delete"
  ON public.formalization_acknowledgements FOR DELETE
  USING (false);


-- Drop existing policies on formalization_evidence_links
DROP POLICY IF EXISTS "Users can view evidence links of accessible formalizations" ON public.formalization_evidence_links;
DROP POLICY IF EXISTS "Users can add evidence links to accessible formalizations" ON public.formalization_evidence_links;

-- FORMALIZATION_EVIDENCE_LINKS RLS POLICIES

-- SELECT: users in org can see
CREATE POLICY "formalization_evidence_links_select_policy"
  ON public.formalization_evidence_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.formalizations f
      WHERE f.id = formalization_id
      AND public.user_belongs_to_org(auth.uid(), f.customer_org_id)
    )
  );

-- INSERT: 
-- - customer: before lock or after lock as supplementary evidence
-- - staff+: always
CREATE POLICY "formalization_evidence_links_insert_policy"
  ON public.formalization_evidence_links FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.formalizations f
      WHERE f.id = formalization_id
      AND public.user_belongs_to_org(auth.uid(), f.customer_org_id)
    )
  );

-- DELETE: only staff+ and before lock
CREATE POLICY "formalization_evidence_links_delete_policy"
  ON public.formalization_evidence_links FOR DELETE
  USING (
    public.user_is_staff_or_above(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.formalizations f
      WHERE f.id = formalization_id
      AND public.user_belongs_to_org(auth.uid(), f.customer_org_id)
      AND f.locked_at IS NULL
    )
  );


-- Drop existing policies on formalization_attachments
DROP POLICY IF EXISTS "Users can view attachments of accessible formalizations" ON public.formalization_attachments;
DROP POLICY IF EXISTS "Users can add attachments to accessible formalizations" ON public.formalization_attachments;

-- FORMALIZATION_ATTACHMENTS RLS POLICIES

-- SELECT: users in org can see
CREATE POLICY "formalization_attachments_select_policy"
  ON public.formalization_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.formalizations f
      WHERE f.id = formalization_id
      AND public.user_belongs_to_org(auth.uid(), f.customer_org_id)
    )
  );

-- INSERT: same as evidence links
CREATE POLICY "formalization_attachments_insert_policy"
  ON public.formalization_attachments FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.formalizations f
      WHERE f.id = formalization_id
      AND public.user_belongs_to_org(auth.uid(), f.customer_org_id)
    )
  );

-- DELETE: only staff+ before lock
CREATE POLICY "formalization_attachments_delete_policy"
  ON public.formalization_attachments FOR DELETE
  USING (
    public.user_is_staff_or_above(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.formalizations f
      WHERE f.id = formalization_id
      AND public.user_belongs_to_org(auth.uid(), f.customer_org_id)
      AND f.locked_at IS NULL
    )
  );


-- Drop existing policies on formalization_events
DROP POLICY IF EXISTS "Users can view events of accessible formalizations" ON public.formalization_events;
DROP POLICY IF EXISTS "System can insert events" ON public.formalization_events;

-- FORMALIZATION_EVENTS RLS POLICIES

-- SELECT: users in org can see
CREATE POLICY "formalization_events_select_policy"
  ON public.formalization_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.formalizations f
      WHERE f.id = formalization_id
      AND public.user_belongs_to_org(auth.uid(), f.customer_org_id)
    )
  );

-- INSERT: authenticated users can insert events for their org
CREATE POLICY "formalization_events_insert_policy"
  ON public.formalization_events FOR INSERT
  WITH CHECK (
    (actor_user_id = auth.uid() OR actor_user_id IS NULL)
    AND EXISTS (
      SELECT 1 FROM public.formalizations f
      WHERE f.id = formalization_id
      AND public.user_belongs_to_org(auth.uid(), f.customer_org_id)
    )
  );

-- No UPDATE/DELETE for events (immutable audit trail)
CREATE POLICY "formalization_events_no_update"
  ON public.formalization_events FOR UPDATE
  USING (false);

CREATE POLICY "formalization_events_no_delete"
  ON public.formalization_events FOR DELETE
  USING (false);


-- CREATE VIEW for customer-facing data
CREATE OR REPLACE VIEW public.formalizations_public_customer AS
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
FROM public.formalizations f
WHERE public.user_belongs_to_org(auth.uid(), f.customer_org_id);

-- Grant access to the view
GRANT SELECT ON public.formalizations_public_customer TO authenticated;

-- Index for profiles
CREATE INDEX IF NOT EXISTS idx_profiles_org_role ON public.profiles(customer_org_id, role);

-- Trigger to auto-create profile on user signup (optional helper)
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, customer_org_id, role, display_name, email)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'customer_org_id')::uuid, gen_random_uuid()),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Create trigger for auto profile creation
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();