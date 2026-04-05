-- Update is_staff function to include 'cs' role
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('engineer', 'manager', 'admin', 'gestor', 'suprimentos', 'financeiro', 'cs')
  )
$$;