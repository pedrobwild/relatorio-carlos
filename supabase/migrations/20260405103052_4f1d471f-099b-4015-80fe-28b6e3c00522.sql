
-- =====================================================
-- 1. FIX HR TABLE SELECT POLICIES (PII EXPOSURE)
-- =====================================================

-- colaboradores: restrict SELECT to admin only
DROP POLICY IF EXISTS "colaboradores_select" ON public.colaboradores;
CREATE POLICY "colaboradores_select" ON public.colaboradores
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- beneficios_colaborador: restrict SELECT to admin only
DROP POLICY IF EXISTS "beneficios_select" ON public.beneficios_colaborador;
CREATE POLICY "beneficios_select" ON public.beneficios_colaborador
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- historico_cargos: restrict SELECT to admin only
DROP POLICY IF EXISTS "historico_select" ON public.historico_cargos;
CREATE POLICY "historico_select" ON public.historico_cargos
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- documentos_colaborador: restrict SELECT to admin only
DROP POLICY IF EXISTS "docs_colab_select" ON public.documentos_colaborador;
CREATE POLICY "docs_colab_select" ON public.documentos_colaborador
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- politicas_comissao: restrict SELECT to admin only
DROP POLICY IF EXISTS "comissao_select" ON public.politicas_comissao;
CREATE POLICY "comissao_select" ON public.politicas_comissao
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- politicas_veiculo: restrict SELECT to admin only
DROP POLICY IF EXISTS "veiculo_select" ON public.politicas_veiculo;
CREATE POLICY "veiculo_select" ON public.politicas_veiculo
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- 2. FIX STORAGE stage-photos POLICIES
-- =====================================================

-- Drop permissive policies
DROP POLICY IF EXISTS "Authenticated users can upload stage photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own stage photos" ON storage.objects;

-- Recreate with project-level access check
-- Upload: user must have project access (path = stage-photos/{project_id}/...)
CREATE POLICY "Project members can upload stage photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'stage-photos'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND has_project_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- Delete: user must have project access
CREATE POLICY "Project members can delete stage photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'stage-photos'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND has_project_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- =====================================================
-- 3. MISSING FK INDEXES (Performance)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_anexos_obra_id ON public.anexos (obra_id);
CREATE INDEX IF NOT EXISTS idx_anexos_uploaded_by ON public.anexos (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_atividades_obra_id ON public.atividades (obra_id);
CREATE INDEX IF NOT EXISTS idx_atividades_responsavel ON public.atividades (responsavel_user_id);
CREATE INDEX IF NOT EXISTS idx_beneficios_colaborador_id ON public.beneficios_colaborador (colaborador_id);
CREATE INDEX IF NOT EXISTS idx_cronogramas_obra_id ON public.cronogramas (obra_id);
CREATE INDEX IF NOT EXISTS idx_docs_colab_colaborador ON public.documentos_colaborador (colaborador_id);
CREATE INDEX IF NOT EXISTS idx_docs_colab_uploaded_by ON public.documentos_colaborador (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_domain_events_actor ON public.domain_events (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_fornecedor_anexos_fornecedor ON public.fornecedor_anexos (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_fornecedor_anexos_uploaded_by ON public.fornecedor_anexos (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_fornecedor_precos_fornecedor ON public.fornecedor_precos (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_fornecedores_created_by ON public.fornecedores (created_by);
CREATE INDEX IF NOT EXISTS idx_historico_cargos_colaborador ON public.historico_cargos (colaborador_id);
CREATE INDEX IF NOT EXISTS idx_historico_cargos_aprovado_por ON public.historico_cargos (aprovado_por);
CREATE INDEX IF NOT EXISTS idx_inspections_activity ON public.inspections (activity_id);
CREATE INDEX IF NOT EXISTS idx_inspections_inspector_user ON public.inspections (inspector_user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_accepted_by ON public.invitations (accepted_by);
CREATE INDEX IF NOT EXISTS idx_invitations_invited_by ON public.invitations (invited_by);
CREATE INDEX IF NOT EXISTS idx_invitations_project ON public.invitations (project_id);
CREATE INDEX IF NOT EXISTS idx_journey_meeting_avail_project ON public.journey_meeting_availability (project_id);
CREATE INDEX IF NOT EXISTS idx_journey_meeting_avail_stage ON public.journey_meeting_availability (stage_id);
CREATE INDEX IF NOT EXISTS idx_journey_meeting_slots_booked_by ON public.journey_meeting_slots (booked_by);
CREATE INDEX IF NOT EXISTS idx_journey_meeting_slots_created_by ON public.journey_meeting_slots (created_by);
CREATE INDEX IF NOT EXISTS idx_journey_stage_msgs_project ON public.journey_stage_messages (project_id);
CREATE INDEX IF NOT EXISTS idx_journey_todos_stage ON public.journey_todos (stage_id);
CREATE INDEX IF NOT EXISTS idx_marcos_cronograma ON public.marcos (cronograma_id);
CREATE INDEX IF NOT EXISTS idx_nc_created_by ON public.non_conformities (created_by);
CREATE INDEX IF NOT EXISTS idx_nc_inspection_item ON public.non_conformities (inspection_item_id);
CREATE INDEX IF NOT EXISTS idx_notifications_project ON public.notifications (project_id);
CREATE INDEX IF NOT EXISTS idx_obra_task_history_changed_by ON public.obra_task_status_history (changed_by);
CREATE INDEX IF NOT EXISTS idx_politicas_comissao_colaborador ON public.politicas_comissao (colaborador_id);
CREATE INDEX IF NOT EXISTS idx_politicas_veiculo_colaborador ON public.politicas_veiculo (colaborador_id);
CREATE INDEX IF NOT EXISTS idx_project_customers_user ON public.project_customers (customer_user_id);
CREATE INDEX IF NOT EXISTS idx_pdr_comments_project ON public.project_document_review_comments (project_id);
CREATE INDEX IF NOT EXISTS idx_project_docs_uploaded_by ON public.project_documents (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_project_member_perms_granted_by ON public.project_member_permissions (granted_by);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects (created_by);
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON public.projects (org_id);
CREATE INDEX IF NOT EXISTS idx_purchase_payment_flows_purchase ON public.purchase_payment_flows (purchase_id);
CREATE INDEX IF NOT EXISTS idx_schedule_jobs_project ON public.schedule_jobs (project_id);
CREATE INDEX IF NOT EXISTS idx_units_project ON public.units (project_id);
