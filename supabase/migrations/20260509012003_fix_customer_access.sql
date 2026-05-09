-- Fix: Customers can't access the system after login because the email-based
-- linking between auth.users and public.project_customers is fragile.
--
-- Problems found:
--   1) RLS policies and the client-side link hook compare customer_email = jwt email
--      with case-sensitive equality. Any case mismatch silently fails — the customer
--      logs in but never gets customer_user_id set, so the dashboard is empty.
--   2) Linking lives only in the client (useLinkCustomerOnLogin). If the JS doesn't
--      run (e.g. the customer signs up via email confirmation and lands directly on
--      a deep link, or a query fails), they never get linked.
--   3) Even after customer_user_id is set, the project_members upsert that the
--      client does is best-effort; failures leave the customer half-linked.
--
-- Fix:
--   1) Normalize all customer_email values to lowercase + trim and enforce it via
--      a BEFORE INSERT/UPDATE trigger.
--   2) Make the customer self-view, self-link, and unlinked-by-email RLS policies
--      case-insensitive.
--   3) Add a SECURITY DEFINER trigger on auth.users that auto-links matching
--      project_customers rows and inserts the corresponding project_members row,
--      so linking no longer depends on the client running successfully.
--   4) Backfill: link any existing project_customers row whose email matches a
--      registered auth.users account, and create the missing project_members rows.

-- 1. Normalize existing data so case-insensitive match works.
UPDATE public.project_customers
SET customer_email = lower(btrim(customer_email))
WHERE customer_email IS DISTINCT FROM lower(btrim(customer_email));

-- 2. Trigger to keep customer_email normalized going forward.
CREATE OR REPLACE FUNCTION public.normalize_project_customer_email()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.customer_email IS NOT NULL THEN
    NEW.customer_email := lower(btrim(NEW.customer_email));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_project_customer_email ON public.project_customers;
CREATE TRIGGER trg_normalize_project_customer_email
  BEFORE INSERT OR UPDATE OF customer_email ON public.project_customers
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_project_customer_email();

-- 3. Recreate customer-facing RLS policies with case-insensitive comparison.
DROP POLICY IF EXISTS "Customers can view unlinked records by email" ON public.project_customers;
CREATE POLICY "Customers can view unlinked records by email"
ON public.project_customers
FOR SELECT
TO authenticated
USING (
  customer_user_id IS NULL
  AND lower(customer_email) = lower(auth.jwt()->>'email')
);

DROP POLICY IF EXISTS "Customers can link own user_id" ON public.project_customers;
CREATE POLICY "Customers can link own user_id"
ON public.project_customers
FOR UPDATE
TO authenticated
USING (
  customer_user_id IS NULL
  AND lower(customer_email) = lower(auth.jwt()->>'email')
)
WITH CHECK (
  lower(customer_email) = lower(auth.jwt()->>'email')
  AND customer_user_id = auth.uid()
);

-- 4. Server-side auto-link on auth.users INSERT.
-- Runs as SECURITY DEFINER so it can bypass RLS and reach project_customers /
-- project_members regardless of whether the trigger fires before the new user's
-- role row exists.
CREATE OR REPLACE FUNCTION public.handle_new_user_link_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized_email text;
BEGIN
  v_normalized_email := lower(btrim(NEW.email));
  IF v_normalized_email IS NULL OR v_normalized_email = '' THEN
    RETURN NEW;
  END IF;

  -- Link any matching project_customers rows that aren't yet bound to a user.
  UPDATE public.project_customers
  SET customer_user_id = NEW.id
  WHERE customer_user_id IS NULL
    AND lower(customer_email) = v_normalized_email;

  -- Ensure a project_members row exists for each linked project so RLS and
  -- queries that pivot on project_members work for this customer.
  INSERT INTO public.project_members (project_id, user_id, role)
  SELECT pc.project_id, NEW.id, 'viewer'::project_role
  FROM public.project_customers pc
  WHERE pc.customer_user_id = NEW.id
  ON CONFLICT (project_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_link_customer ON auth.users;
CREATE TRIGGER on_auth_user_created_link_customer
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_link_customer();

-- 5. One-shot backfill for the customers who were created BEFORE this trigger
-- existed. This is the chunk that should immediately unblock today's users.
DO $$
DECLARE
  v_linked integer := 0;
  v_members integer := 0;
BEGIN
  WITH linked AS (
    UPDATE public.project_customers pc
    SET customer_user_id = u.id
    FROM auth.users u
    WHERE pc.customer_user_id IS NULL
      AND pc.customer_email IS NOT NULL
      AND lower(pc.customer_email) = lower(u.email)
    RETURNING pc.project_id, u.id AS user_id
  )
  SELECT count(*) INTO v_linked FROM linked;

  WITH inserted AS (
    INSERT INTO public.project_members (project_id, user_id, role)
    SELECT pc.project_id, pc.customer_user_id, 'viewer'::project_role
    FROM public.project_customers pc
    WHERE pc.customer_user_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = pc.project_id
          AND pm.user_id = pc.customer_user_id
      )
    ON CONFLICT (project_id, user_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_members FROM inserted;

  RAISE NOTICE 'Customer access backfill: linked=% members_added=%', v_linked, v_members;
END $$;
