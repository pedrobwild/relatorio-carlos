
CREATE OR REPLACE FUNCTION public.complete_inspection(p_inspection_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inspection RECORD;
  v_pending_count integer;
  v_rejected_no_photo integer;
BEGIN
  SELECT * INTO v_inspection FROM public.inspections WHERE id = p_inspection_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vistoria não encontrada: %', p_inspection_id;
  END IF;

  IF v_inspection.status = 'completed' THEN
    RAISE EXCEPTION 'Vistoria já está concluída';
  END IF;

  IF NOT has_project_access(auth.uid(), v_inspection.project_id) THEN
    RAISE EXCEPTION 'Acesso negado ao projeto';
  END IF;

  IF NOT is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Somente staff pode finalizar vistorias';
  END IF;

  -- Check all items evaluated
  SELECT COUNT(*) INTO v_pending_count
  FROM public.inspection_items
  WHERE inspection_id = p_inspection_id AND result = 'pending';

  IF v_pending_count > 0 THEN
    RAISE EXCEPTION 'Ainda há % itens pendentes', v_pending_count;
  END IF;

  -- Check rejected items have photos
  SELECT COUNT(*) INTO v_rejected_no_photo
  FROM public.inspection_items
  WHERE inspection_id = p_inspection_id
    AND result = 'rejected'
    AND (photo_paths IS NULL OR array_length(photo_paths, 1) IS NULL);

  IF v_rejected_no_photo > 0 THEN
    RAISE EXCEPTION 'Todos os itens reprovados devem ter fotos de evidência';
  END IF;

  UPDATE public.inspections
  SET status = 'completed',
      completed_at = now(),
      updated_at = now()
  WHERE id = p_inspection_id;
END;
$$;
