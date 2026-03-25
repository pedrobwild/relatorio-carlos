DROP FUNCTION IF EXISTS public.get_user_projects_summary();

CREATE OR REPLACE FUNCTION public.get_user_projects_summary()
RETURNS TABLE (
  id uuid,
  name text,
  status text,
  org_id uuid,
  org_name text,
  planned_start_date date,
  planned_end_date date,
  actual_start_date date,
  actual_end_date date,
  contract_value numeric,
  user_role text,
  pending_count bigint,
  overdue_count bigint,
  unsigned_formalizations bigint,
  pending_documents bigint,
  progress_percentage numeric,
  last_activity_at timestamptz,
  is_project_phase boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.name,
    p.status::text,
    p.org_id,
    o.name as org_name,
    p.planned_start_date,
    p.planned_end_date,
    p.actual_start_date,
    p.actual_end_date,
    p.contract_value,
    pm.role::text as user_role,
    (SELECT COUNT(*) FROM pending_items pi 
     WHERE pi.project_id = p.id AND pi.status = 'pending') as pending_count,
    (SELECT COUNT(*) FROM pending_items pi 
     WHERE pi.project_id = p.id AND pi.status = 'pending' 
     AND pi.due_date < CURRENT_DATE) as overdue_count,
    (SELECT COUNT(*) FROM formalizations f 
     WHERE f.project_id = p.id AND f.status = 'pending_signatures') as unsigned_formalizations,
    (SELECT COUNT(*) FROM project_documents pd 
     WHERE pd.project_id = p.id AND pd.status = 'pending' 
     AND pd.parent_document_id IS NULL) as pending_documents,
    CASE 
      WHEN p.actual_end_date IS NOT NULL THEN 100
      WHEN p.actual_start_date IS NULL THEN 0
      ELSE LEAST(100, ROUND(
        (CURRENT_DATE - p.actual_start_date)::numeric / 
        NULLIF((p.planned_end_date - p.actual_start_date)::numeric, 0) * 100
      , 1))
    END as progress_percentage,
    (SELECT MAX(created_at) FROM domain_events de 
     WHERE de.project_id = p.id) as last_activity_at,
    p.is_project_phase
  FROM projects p
  JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = auth.uid()
  LEFT JOIN orgs o ON o.id = p.org_id
  ORDER BY 
    CASE p.status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
    p.planned_end_date ASC;
$$;