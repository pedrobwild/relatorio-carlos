-- =============================================
-- RPC: transition_nc_status (SECURITY DEFINER)
-- Centralizes all NC status transition logic in the database
-- =============================================

CREATE OR REPLACE FUNCTION public.transition_nc_status(
  p_nc_id uuid,
  p_new_status public.nc_status,
  p_notes text DEFAULT NULL,
  p_corrective_action text DEFAULT NULL,
  p_resolution_notes text DEFAULT NULL,
  p_rejection_reason text DEFAULT NULL,
  p_evidence_photo_paths text[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nc RECORD;
  v_user_role text;
  v_valid_transition boolean := false;
BEGIN
  SELECT * INTO v_nc FROM public.non_conformities WHERE id = p_nc_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NC não encontrada: %', p_nc_id;
  END IF;

  SELECT role::text INTO v_user_role
  FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;

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

  IF p_new_status = 'closed' AND v_user_role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Somente admin ou manager pode encerrar uma NC';
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
    evidence_photo_paths = COALESCE(p_evidence_photo_paths, evidence_photo_paths),
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

DROP POLICY IF EXISTS "Staff can manage non conformities" ON public.non_conformities;

CREATE POLICY "Staff can update nc non-status fields"
  ON public.non_conformities FOR UPDATE
  TO authenticated
  USING (
    is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id)
  )
  WITH CHECK (
    is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id)
  );