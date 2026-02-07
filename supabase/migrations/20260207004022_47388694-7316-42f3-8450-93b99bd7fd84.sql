
-- Fix has_project_access to include project_members
-- BUG: Function only checked project_engineers and project_customers,
-- but the new system primarily uses project_members

CREATE OR REPLACE FUNCTION public.has_project_access(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    -- Admin has access to all
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
    UNION
    -- Member of project (new unified system)
    SELECT 1 FROM public.project_members WHERE user_id = _user_id AND project_id = _project_id
    UNION
    -- Engineer assigned to project (legacy)
    SELECT 1 FROM public.project_engineers WHERE engineer_user_id = _user_id AND project_id = _project_id
    UNION
    -- Customer linked to project (legacy)
    SELECT 1 FROM public.project_customers WHERE customer_user_id = _user_id AND project_id = _project_id
  )
$$;
