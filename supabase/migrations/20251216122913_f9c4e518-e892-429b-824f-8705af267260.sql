-- Migrate existing project_engineers to project_members
INSERT INTO public.project_members (project_id, user_id, role, created_at)
SELECT 
  project_id,
  engineer_user_id,
  CASE WHEN is_primary THEN 'owner'::project_role ELSE 'engineer'::project_role END,
  created_at
FROM public.project_engineers
ON CONFLICT (project_id, user_id) DO NOTHING;

-- Migrate existing project_customers to project_members (only those with user accounts)
INSERT INTO public.project_members (project_id, user_id, role, created_at)
SELECT 
  project_id,
  customer_user_id,
  'customer'::project_role,
  created_at
FROM public.project_customers
WHERE customer_user_id IS NOT NULL
ON CONFLICT (project_id, user_id) DO NOTHING;