-- =====================================================
-- RLS POLICIES - PARTE 2
-- =====================================================

-- =====================================================
-- POLICIES: users_profile
-- =====================================================

-- Admin pode fazer tudo
CREATE POLICY "admin_users_profile_all" ON public.users_profile
  FOR ALL
  USING (public.is_admin_v2())
  WITH CHECK (public.is_admin_v2());

-- Usuário pode ver seu próprio registro
CREATE POLICY "user_view_own_profile" ON public.users_profile
  FOR SELECT
  USING (id = auth.uid());

-- Usuário pode atualizar apenas campos pessoais (não perfil/status/email)
CREATE POLICY "user_update_own_profile" ON public.users_profile
  FOR UPDATE
  USING (id = auth.uid() AND NOT public.is_admin_v2())
  WITH CHECK (
    id = auth.uid() 
    AND perfil = (SELECT perfil FROM public.users_profile WHERE id = auth.uid())
    AND status = (SELECT status FROM public.users_profile WHERE id = auth.uid())
    AND email = (SELECT email FROM public.users_profile WHERE id = auth.uid())
  );

-- =====================================================
-- POLICIES: user_obra_access
-- =====================================================

-- Admin pode fazer tudo
CREATE POLICY "admin_user_obra_access_all" ON public.user_obra_access
  FOR ALL
  USING (public.is_admin_v2())
  WITH CHECK (public.is_admin_v2());

-- Usuário pode ver seus próprios vínculos
CREATE POLICY "user_view_own_access" ON public.user_obra_access
  FOR SELECT
  USING (user_id = auth.uid());

-- =====================================================
-- POLICIES: obras
-- =====================================================

-- Admin pode fazer tudo
CREATE POLICY "admin_obras_all" ON public.obras
  FOR ALL
  USING (public.is_admin_v2())
  WITH CHECK (public.is_admin_v2());

-- Usuário com acesso pode visualizar
CREATE POLICY "user_view_obras" ON public.obras
  FOR SELECT
  USING (public.has_obra_access(id));

-- Gestor pode atualizar obras que tem acesso
CREATE POLICY "gestor_update_obras" ON public.obras
  FOR UPDATE
  USING (
    public.has_obra_access(id) 
    AND public.get_effective_role(id) IN ('gestor', 'manager')
  )
  WITH CHECK (
    public.has_obra_access(id) 
    AND public.get_effective_role(id) IN ('gestor', 'manager')
  );

-- =====================================================
-- POLICIES: obras_studio_info
-- =====================================================

-- Admin pode fazer tudo
CREATE POLICY "admin_studio_info_all" ON public.obras_studio_info
  FOR ALL
  USING (public.is_admin_v2())
  WITH CHECK (public.is_admin_v2());

-- Usuário com acesso pode visualizar
CREATE POLICY "user_view_studio_info" ON public.obras_studio_info
  FOR SELECT
  USING (public.has_obra_access(obra_id));

-- Gestor pode editar
CREATE POLICY "gestor_update_studio_info" ON public.obras_studio_info
  FOR UPDATE
  USING (
    public.has_obra_access(obra_id) 
    AND public.get_effective_role(obra_id) IN ('gestor', 'manager')
  )
  WITH CHECK (
    public.has_obra_access(obra_id) 
    AND public.get_effective_role(obra_id) IN ('gestor', 'manager')
  );

-- Gestor pode inserir
CREATE POLICY "gestor_insert_studio_info" ON public.obras_studio_info
  FOR INSERT
  WITH CHECK (
    public.has_obra_access(obra_id) 
    AND public.get_effective_role(obra_id) IN ('gestor', 'manager', 'admin')
  );

-- =====================================================
-- POLICIES: cronogramas
-- =====================================================

-- Admin pode fazer tudo
CREATE POLICY "admin_cronogramas_all" ON public.cronogramas
  FOR ALL
  USING (public.is_admin_v2())
  WITH CHECK (public.is_admin_v2());

-- Usuário com acesso pode visualizar
CREATE POLICY "user_view_cronogramas" ON public.cronogramas
  FOR SELECT
  USING (public.has_obra_access(obra_id));

-- Gestor pode CRUD
CREATE POLICY "gestor_insert_cronogramas" ON public.cronogramas
  FOR INSERT
  WITH CHECK (public.can_edit_cronograma(obra_id));

CREATE POLICY "gestor_update_cronogramas" ON public.cronogramas
  FOR UPDATE
  USING (public.can_edit_cronograma(obra_id))
  WITH CHECK (public.can_edit_cronograma(obra_id));

CREATE POLICY "gestor_delete_cronogramas" ON public.cronogramas
  FOR DELETE
  USING (public.can_edit_cronograma(obra_id));

-- =====================================================
-- POLICIES: marcos
-- =====================================================

-- Admin pode fazer tudo
CREATE POLICY "admin_marcos_all" ON public.marcos
  FOR ALL
  USING (public.is_admin_v2())
  WITH CHECK (public.is_admin_v2());

-- Usuário com acesso pode visualizar (via cronograma -> obra)
CREATE POLICY "user_view_marcos" ON public.marcos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cronogramas c 
      WHERE c.id = marcos.cronograma_id 
      AND public.has_obra_access(c.obra_id)
    )
  );

-- Gestor pode CRUD
CREATE POLICY "gestor_insert_marcos" ON public.marcos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cronogramas c 
      WHERE c.id = cronograma_id 
      AND public.can_edit_cronograma(c.obra_id)
    )
  );

CREATE POLICY "gestor_update_marcos" ON public.marcos
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.cronogramas c 
      WHERE c.id = marcos.cronograma_id 
      AND public.can_edit_cronograma(c.obra_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cronogramas c 
      WHERE c.id = cronograma_id 
      AND public.can_edit_cronograma(c.obra_id)
    )
  );

CREATE POLICY "gestor_delete_marcos" ON public.marcos
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.cronogramas c 
      WHERE c.id = marcos.cronograma_id 
      AND public.can_edit_cronograma(c.obra_id)
    )
  );

-- =====================================================
-- POLICIES: atividades
-- =====================================================

-- Admin pode fazer tudo
CREATE POLICY "admin_atividades_all" ON public.atividades
  FOR ALL
  USING (public.is_admin_v2())
  WITH CHECK (public.is_admin_v2());

-- Usuário com acesso pode visualizar
CREATE POLICY "user_view_atividades" ON public.atividades
  FOR SELECT
  USING (public.has_obra_access(obra_id));

-- Engenheiro/Gestor podem criar/editar/deletar
CREATE POLICY "staff_insert_atividades" ON public.atividades
  FOR INSERT
  WITH CHECK (public.can_edit_atividades(obra_id));

CREATE POLICY "staff_update_atividades" ON public.atividades
  FOR UPDATE
  USING (public.can_edit_atividades(obra_id))
  WITH CHECK (public.can_edit_atividades(obra_id));

CREATE POLICY "staff_delete_atividades" ON public.atividades
  FOR DELETE
  USING (public.can_edit_atividades(obra_id));

-- =====================================================
-- POLICIES: anexos
-- =====================================================

-- Admin pode fazer tudo
CREATE POLICY "admin_anexos_all" ON public.anexos
  FOR ALL
  USING (public.is_admin_v2())
  WITH CHECK (public.is_admin_v2());

-- Usuário com acesso pode visualizar (exceto cliente não vê financeiro - futuro)
CREATE POLICY "user_view_anexos" ON public.anexos
  FOR SELECT
  USING (public.has_obra_access(obra_id));

-- Staff pode criar anexos
CREATE POLICY "staff_insert_anexos" ON public.anexos
  FOR INSERT
  WITH CHECK (
    public.has_obra_access(obra_id)
    AND uploaded_by = auth.uid()
    AND public.get_effective_role(obra_id) NOT IN ('customer', 'cliente')
  );

-- Staff pode deletar próprios anexos
CREATE POLICY "staff_delete_anexos" ON public.anexos
  FOR DELETE
  USING (
    public.has_obra_access(obra_id)
    AND (uploaded_by = auth.uid() OR public.is_admin_v2())
  );

-- =====================================================
-- POLICIES: auditoria
-- =====================================================

-- Admin pode ver tudo
CREATE POLICY "admin_view_auditoria" ON public.auditoria
  FOR SELECT
  USING (public.is_admin_v2());

-- Gestor pode ver auditoria das obras que tem acesso
CREATE POLICY "gestor_view_auditoria" ON public.auditoria
  FOR SELECT
  USING (
    public.get_effective_role(obra_id) IN ('gestor', 'manager')
    AND public.has_obra_access(obra_id)
  );

-- Sistema pode inserir auditoria (via trigger)
CREATE POLICY "system_insert_auditoria" ON public.auditoria
  FOR INSERT
  WITH CHECK (true);

-- Ninguém pode atualizar ou deletar auditoria
CREATE POLICY "no_update_auditoria" ON public.auditoria
  FOR UPDATE
  USING (false);

CREATE POLICY "no_delete_auditoria" ON public.auditoria
  FOR DELETE
  USING (false);