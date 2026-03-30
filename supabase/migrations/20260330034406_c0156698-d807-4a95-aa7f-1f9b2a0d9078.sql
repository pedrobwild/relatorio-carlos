CREATE OR REPLACE FUNCTION public.create_inspection_with_items(
  p_project_id uuid,
  p_activity_id uuid DEFAULT NULL,
  p_inspector_id uuid DEFAULT NULL,
  p_inspection_date date DEFAULT CURRENT_DATE,
  p_notes text DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inspection_id uuid;
  v_item jsonb;
BEGIN
  IF NOT is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Somente staff pode criar vistorias';
  END IF;

  IF NOT has_project_access(auth.uid(), p_project_id) THEN
    RAISE EXCEPTION 'Acesso negado ao projeto';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Vistoria deve ter pelo menos um item no checklist';
  END IF;

  INSERT INTO public.inspections (
    project_id, activity_id, inspector_id,
    inspection_date, notes, status
  )
  VALUES (
    p_project_id,
    p_activity_id,
    COALESCE(p_inspector_id, auth.uid()),
    p_inspection_date,
    p_notes,
    'draft'
  )
  RETURNING id INTO v_inspection_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.inspection_items (inspection_id, description, sort_order)
    VALUES (v_inspection_id, v_item->>'description', (v_item->>'sort_order')::int);
  END LOOP;

  RETURN v_inspection_id;
END;
$$;