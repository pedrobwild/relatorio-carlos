
-- Status: detecta colunas e conta divergências
CREATE OR REPLACE FUNCTION public.pii_projects_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_columns_present integer;
  v_with_pii integer := 0;
  v_pending_backfill integer := 0;
  v_in_pc integer;
  v_divergences integer := 0;
BEGIN
  IF NOT public.is_admin_v2() THEN
    RAISE EXCEPTION 'Apenas administradores podem executar esta operação';
  END IF;

  SELECT count(*) INTO v_columns_present
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='projects'
    AND column_name IN ('client_name','client_email','client_phone');

  SELECT count(DISTINCT project_id) INTO v_in_pc FROM public.project_customers;

  IF v_columns_present > 0 THEN
    EXECUTE $sql$
      SELECT count(*) FROM public.projects
      WHERE COALESCE(NULLIF(btrim(client_name),''), NULLIF(btrim(client_email),''), NULLIF(btrim(client_phone),'')) IS NOT NULL
    $sql$ INTO v_with_pii;

    EXECUTE $sql$
      SELECT count(*) FROM public.projects p
      WHERE COALESCE(NULLIF(btrim(p.client_email),''), NULLIF(btrim(p.client_name),'')) IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.project_customers pc
          WHERE pc.project_id = p.id
            AND lower(pc.customer_email) = lower(COALESCE(NULLIF(btrim(p.client_email),''), ''))
        )
    $sql$ INTO v_pending_backfill;

    EXECUTE $sql$
      SELECT count(*) FROM public.projects p
      JOIN public.project_customers pc ON pc.project_id = p.id
      WHERE (
        (NULLIF(btrim(p.client_email),'') IS NOT NULL AND lower(NULLIF(btrim(p.client_email),'')) IS DISTINCT FROM lower(pc.customer_email))
        OR (NULLIF(btrim(p.client_name),'') IS NOT NULL AND NULLIF(btrim(p.client_name),'') IS DISTINCT FROM pc.customer_name)
        OR (NULLIF(btrim(p.client_phone),'') IS NOT NULL AND NULLIF(btrim(p.client_phone),'') IS DISTINCT FROM COALESCE(pc.customer_phone,''))
      )
    $sql$ INTO v_divergences;
  END IF;

  RETURN jsonb_build_object(
    'columns_present', v_columns_present,
    'columns_removed', v_columns_present = 0,
    'with_pii_in_projects', v_with_pii,
    'pending_backfill', v_pending_backfill,
    'projects_in_project_customers', v_in_pc,
    'divergences', v_divergences,
    'checked_at', now()
  );
END;
$$;

-- Backfill: copia projects.client_* -> project_customers
CREATE OR REPLACE FUNCTION public.pii_projects_backfill()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
  v_columns_present integer;
BEGIN
  IF NOT public.is_admin_v2() THEN
    RAISE EXCEPTION 'Apenas administradores podem executar esta operação';
  END IF;

  SELECT count(*) INTO v_columns_present
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='projects'
    AND column_name IN ('client_name','client_email','client_phone');

  IF v_columns_present = 0 THEN
    RETURN jsonb_build_object('inserted', 0, 'skipped_columns_missing', true);
  END IF;

  EXECUTE $sql$
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
    ON CONFLICT (project_id, customer_email) DO NOTHING
  $sql$;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN jsonb_build_object('inserted', v_inserted, 'ran_at', now());
END;
$$;

-- Drop colunas legadas (irreversível)
CREATE OR REPLACE FUNCTION public.pii_projects_drop_legacy_columns()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending integer := 0;
  v_columns_present integer;
BEGIN
  IF NOT public.is_admin_v2() THEN
    RAISE EXCEPTION 'Apenas administradores podem executar esta operação';
  END IF;

  SELECT count(*) INTO v_columns_present
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='projects'
    AND column_name IN ('client_name','client_email','client_phone');

  IF v_columns_present = 0 THEN
    RETURN jsonb_build_object('dropped', false, 'message', 'Colunas já foram removidas');
  END IF;

  EXECUTE $sql$
    SELECT count(*) FROM public.projects p
    WHERE COALESCE(NULLIF(btrim(p.client_email),''), NULLIF(btrim(p.client_name),'')) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.project_customers pc
        WHERE pc.project_id = p.id
          AND lower(pc.customer_email) = lower(COALESCE(NULLIF(btrim(p.client_email),''), ''))
      )
  $sql$ INTO v_pending;

  IF v_pending > 0 THEN
    RAISE EXCEPTION 'Backfill incompleto: % obra(s) ainda têm PII em projects sem correspondente em project_customers. Rode o backfill antes de remover as colunas.', v_pending;
  END IF;

  ALTER TABLE public.projects DROP COLUMN IF EXISTS client_name;
  ALTER TABLE public.projects DROP COLUMN IF EXISTS client_email;
  ALTER TABLE public.projects DROP COLUMN IF EXISTS client_phone;

  RETURN jsonb_build_object('dropped', true, 'ran_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.pii_projects_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pii_projects_backfill() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pii_projects_drop_legacy_columns() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pii_projects_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pii_projects_backfill() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pii_projects_drop_legacy_columns() TO authenticated;
