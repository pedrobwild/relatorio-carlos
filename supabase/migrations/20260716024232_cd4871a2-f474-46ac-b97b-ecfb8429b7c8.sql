CREATE OR REPLACE FUNCTION public.link_project_customer_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_user_id IS NULL AND NEW.customer_email IS NOT NULL THEN
    SELECT u.id INTO NEW.customer_user_id
    FROM auth.users u
    WHERE lower(u.email) = lower(btrim(NEW.customer_email))
      AND u.deleted_at IS NULL
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_project_customer_user ON public.project_customers;
CREATE TRIGGER trg_link_project_customer_user
  BEFORE INSERT OR UPDATE OF customer_email ON public.project_customers
  FOR EACH ROW
  EXECUTE FUNCTION public.link_project_customer_user();

CREATE OR REPLACE FUNCTION public.ensure_project_member_for_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_user_id IS NOT NULL THEN
    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES (NEW.project_id, NEW.customer_user_id, 'viewer'::project_role)
    ON CONFLICT (project_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_project_member_for_customer ON public.project_customers;
CREATE TRIGGER trg_ensure_project_member_for_customer
  AFTER INSERT OR UPDATE OF customer_user_id, customer_email ON public.project_customers
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_project_member_for_customer();

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
      AND u.deleted_at IS NULL
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

  RAISE NOTICE 'Customer link backfill: linked=% members_added=%', v_linked, v_members;
END $$;