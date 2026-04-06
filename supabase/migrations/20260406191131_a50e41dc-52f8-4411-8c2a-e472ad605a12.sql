CREATE OR REPLACE FUNCTION public.transition_nc_status(
  p_nc_id uuid,
  p_new_status text,
  p_notes text DEFAULT NULL,
  p_corrective_action text DEFAULT NULL,
  p_resolution_notes text DEFAULT NULL,
  p_rejection_reason text DEFAULT NULL,
  p_evidence_photos_before text[] DEFAULT NULL,
  p_evidence_photos_after text[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_nc RECORD;
  v_valid_transition boolean := false;
  v_can_close boolean := false;
BEGIN
  SELECT * INTO v_nc FROM public.non_conformities WHERE id = p_nc_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NC não encontrada: %', p_nc_id;
  END IF;

  IF NOT has_project_access(auth.uid(), v_nc.project_id) THEN
    RAISE EXCEPTION 'Acesso negado ao projeto';
  END IF;

  IF NOT is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Somente staff pode atualizar NCs';
  END IF;

  v_valid_transition := CASE
    WHEN v_nc.status = 'open'                 AND p_new_status = 'in_treatment'         THEN true
    WHEN v_nc.status = 'reopened'             AND p_new_status = 'in_treatment'         THEN true
    WHEN v_nc.status = 'in_treatment'         AND p_new_status = 'pending_verification' THEN true
    WHEN v_nc.status = 'pending_verification' AND p_new_status = 'pending_approval'     THEN true
    WHEN v_nc.status = 'pending_verification' AND p_new_status = 'reopened'             THEN true
    WHEN v_nc.status = 'pending_approval'     AND p_new_status = 'closed'               THEN true
    WHEN v_nc.status = 'pending_approval'     AND p_new_status = 'reopened'             THEN true
    ELSE false
  END;

  IF NOT v_valid_transition THEN
    RAISE EXCEPTION 'Transição inválida: % → %', v_nc.status, p_new_status;
  END IF;

  -- Check close permission: allow admin, manager, engineer, gestor, cs, arquitetura
  IF p_new_status = 'closed' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'manager', 'engineer', 'gestor', 'cs', 'arquitetura')
    ) INTO v_can_close;

    IF NOT v_can_close THEN
      RAISE EXCEPTION 'Sem permissão para encerrar uma NC';
    END IF;
  END IF;

  IF p_new_status = 'in_treatment' AND (p_corrective_action IS NULL OR trim(p_corrective_action) = '') THEN
    RAISE EXCEPTION 'Ação corretiva obrigatória para iniciar tratamento';
  END IF;

  IF p_new_status = 'pending_verification' AND (p_resolution_notes IS NULL OR trim(p_resolution_notes) = '') THEN
    RAISE EXCEPTION 'Notas de resolução obrigatórias para enviar verificação';
  END IF;

  IF p_new_status = 'reopened' AND (p_rejection_reason IS NULL OR trim(p_rejection_reason) = '') THEN
    RAISE EXCEPTION 'Motivo de rejeição obrigatório para reabrir NC';
  END IF;

  UPDATE public.non_conformities SET
    status = p_new_status,
    corrective_action = COALESCE(p_corrective_action, corrective_action),
    resolution_notes = COALESCE(p_resolution_notes, resolution_notes),
    rejection_reason = CASE WHEN p_new_status = 'reopened' THEN p_rejection_reason ELSE rejection_reason END,
    evidence_photos_before = COALESCE(p_evidence_photos_before, evidence_photos_before),
    evidence_photos_after = COALESCE(p_evidence_photos_after, evidence_photos_after),
    resolved_at = CASE WHEN p_new_status = 'pending_verification' THEN now() ELSE resolved_at END,
    resolved_by = CASE WHEN p_new_status = 'pending_verification' THEN auth.uid() ELSE resolved_by END,
    verified_at = CASE WHEN p_new_status = 'pending_approval' THEN now() ELSE verified_at END,
    verified_by = CASE WHEN p_new_status = 'pending_approval' THEN auth.uid() ELSE verified_by END,
    approved_at = CASE WHEN p_new_status = 'closed' THEN now() ELSE approved_at END,
    approved_by = CASE WHEN p_new_status = 'closed' THEN auth.uid() ELSE approved_by END,
    updated_at = now()
  WHERE id = p_nc_id;

  INSERT INTO public.nc_history (nc_id, action, old_status, new_status, notes, actor_id)
  VALUES (
    p_nc_id,
    CASE p_new_status
      WHEN 'in_treatment' THEN 'Iniciou tratamento'
      WHEN 'pending_verification' THEN 'Enviou para verificação'
      WHEN 'pending_approval' THEN 'Verificação concluída, aguardando aprovação'
      WHEN 'closed' THEN 'Aprovada e encerrada'
      WHEN 'reopened' THEN 'Reaberta'
      ELSE 'Status alterado'
    END,
    v_nc.status,
    p_new_status,
    COALESCE(p_notes, p_resolution_notes, p_rejection_reason),
    auth.uid()
  );
END;
$$;