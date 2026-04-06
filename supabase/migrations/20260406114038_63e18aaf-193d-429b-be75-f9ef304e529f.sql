CREATE OR REPLACE FUNCTION public.get_user_projects_summary()
 RETURNS TABLE(id uuid, name text, status text, org_id uuid, org_name text, planned_start_date date, planned_end_date date, actual_start_date date, actual_end_date date, contract_value numeric, user_role text, pending_count bigint, overdue_count bigint, unsigned_formalizations bigint, pending_documents bigint, progress_percentage numeric, last_activity_at timestamp with time zone, is_project_phase boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
    COALESCE(pm.role::text, 'viewer') as user_role,
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
    -- Progress based on completed activity weights (unified logic)
    COALESCE((
      SELECT CASE 
        WHEN SUM(pa.weight) = 0 OR COUNT(*) = 0 THEN 0
        ELSE ROUND(
          SUM(CASE WHEN pa.actual_end IS NOT NULL THEN pa.weight ELSE 0 END) 
          / NULLIF(SUM(pa.weight), 0) * 100
        , 1)
      END
      FROM project_activities pa
      WHERE pa.project_id = p.id
    ), 0) as progress_percentage,
    (SELECT MAX(created_at) FROM domain_events de 
     WHERE de.project_id = p.id) as last_activity_at,
    p.is_project_phase
  FROM projects p
  LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = auth.uid()
  LEFT JOIN project_customers pc ON pc.project_id = p.id AND pc.customer_user_id = auth.uid()
  LEFT JOIN orgs o ON o.id = p.org_id
  WHERE pm.user_id IS NOT NULL OR pc.customer_user_id IS NOT NULL
  GROUP BY p.id, p.name, p.status, p.org_id, o.name, p.planned_start_date, p.planned_end_date,
           p.actual_start_date, p.actual_end_date, p.contract_value, pm.role,
           p.is_project_phase
  ORDER BY 
    CASE p.status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
    p.planned_end_date ASC;
$$;