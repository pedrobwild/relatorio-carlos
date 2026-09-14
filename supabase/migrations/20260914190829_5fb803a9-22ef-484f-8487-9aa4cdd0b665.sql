CREATE OR REPLACE FUNCTION public.find_duplicate_project(
  p_customer_email text,
  p_address text,
  p_unit_name text DEFAULT NULL
)
RETURNS TABLE (
  project_id uuid,
  project_name text,
  unit_name text,
  address text,
  status text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id,
         p.name,
         p.unit_name,
         p.address,
         p.status::text,
         p.created_at
  FROM public.projects p
  JOIN public.project_customers pc ON pc.project_id = p.id
  WHERE p.deleted_at IS NULL
    AND lower(regexp_replace(btrim(coalesce(pc.customer_email, '')), '\s+', ' ', 'g'))
        = lower(regexp_replace(btrim(coalesce(p_customer_email, '')), '\s+', ' ', 'g'))
    AND coalesce(p_customer_email, '') <> ''
    AND lower(regexp_replace(btrim(coalesce(p.address, '')), '\s+', ' ', 'g'))
        = lower(regexp_replace(btrim(coalesce(p_address, '')), '\s+', ' ', 'g'))
    AND coalesce(p_address, '') <> ''
    AND lower(regexp_replace(btrim(coalesce(p.unit_name, '')), '\s+', ' ', 'g'))
        = lower(regexp_replace(btrim(coalesce(p_unit_name, '')), '\s+', ' ', 'g'))
  ORDER BY p.created_at ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_duplicate_project(text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.find_duplicate_project(text, text, text) TO authenticated, service_role;