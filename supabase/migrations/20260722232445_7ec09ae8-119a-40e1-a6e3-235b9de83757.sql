
-- 1) Normalize customer_email on project_customers via trigger
CREATE OR REPLACE FUNCTION public.normalize_project_customer_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_email IS NOT NULL THEN
    NEW.customer_email := lower(btrim(NEW.customer_email));
    IF NEW.customer_email = '' THEN
      NEW.customer_email := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_project_customer_email ON public.project_customers;
CREATE TRIGGER trg_normalize_project_customer_email
  BEFORE INSERT OR UPDATE OF customer_email ON public.project_customers
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_project_customer_email();

-- Backfill existing rows in-place (trigger will normalize)
UPDATE public.project_customers
   SET customer_email = customer_email
 WHERE customer_email IS NOT NULL
   AND customer_email <> lower(btrim(customer_email));

-- 2) Replace soft_delete_project with guard: prevent deleting the last active
-- project of any linked customer, unless p_force = true (admin override).
CREATE OR REPLACE FUNCTION public.soft_delete_project(
  p_project_id uuid,
  p_force boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_blocking_email text;
  v_blocking_user_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.can_manage_project(auth.uid(), p_project_id)) THEN
    RAISE EXCEPTION 'Sem permissão para excluir esta obra';
  END IF;

  v_is_admin := public.has_role(auth.uid(), 'admin');

  IF NOT COALESCE(p_force, false) THEN
    -- Look for any customer whose only remaining active project is this one.
    WITH linked_users AS (
      SELECT DISTINCT pc.customer_user_id AS user_id, pc.customer_email
        FROM public.project_customers pc
       WHERE pc.project_id = p_project_id
         AND pc.customer_user_id IS NOT NULL
      UNION
      SELECT DISTINCT pm.user_id, NULL::text
        FROM public.project_members pm
       WHERE pm.project_id = p_project_id
         AND pm.role = 'viewer'
    ),
    counts AS (
      SELECT lu.user_id,
             lu.customer_email,
             (
               SELECT COUNT(*) FROM public.projects p2
                LEFT JOIN public.project_customers pc2
                       ON pc2.project_id = p2.id AND pc2.customer_user_id = lu.user_id
                LEFT JOIN public.project_members pm2
                       ON pm2.project_id = p2.id AND pm2.user_id = lu.user_id
                WHERE p2.deleted_at IS NULL
                  AND p2.status = 'active'
                  AND p2.id <> p_project_id
                  AND (pc2.project_id IS NOT NULL OR pm2.project_id IS NOT NULL)
             ) AS other_active
        FROM linked_users lu
    )
    SELECT COALESCE(customer_email, user_id::text), user_id
      INTO v_blocking_email, v_blocking_user_id
      FROM counts
     WHERE other_active = 0
     LIMIT 1;

    IF v_blocking_user_id IS NOT NULL THEN
      RAISE EXCEPTION
        'Esta é a única obra ativa do cliente %. Transfira/vincule o cliente a outra obra antes de excluir, ou use a exclusão forçada.',
        v_blocking_email
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    -- Force path requires admin
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Somente administradores podem usar a exclusão forçada';
    END IF;
  END IF;

  UPDATE public.projects
     SET deleted_at = now(),
         updated_at = now()
   WHERE id = p_project_id
     AND deleted_at IS NULL;
END;
$$;
