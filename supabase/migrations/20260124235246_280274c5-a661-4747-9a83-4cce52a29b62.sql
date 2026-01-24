-- =====================================================
-- TRIGGERS DE AUDITORIA - PARTE 3
-- =====================================================

-- Função genérica para auditoria
CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_obra_id uuid;
  v_diff jsonb;
BEGIN
  -- Determinar obra_id baseado na tabela
  IF TG_TABLE_NAME = 'obras' THEN
    v_obra_id := COALESCE(NEW.id, OLD.id);
  ELSIF TG_TABLE_NAME = 'obras_studio_info' THEN
    v_obra_id := COALESCE(NEW.obra_id, OLD.obra_id);
  ELSIF TG_TABLE_NAME = 'cronogramas' THEN
    v_obra_id := COALESCE(NEW.obra_id, OLD.obra_id);
  ELSIF TG_TABLE_NAME = 'marcos' THEN
    SELECT c.obra_id INTO v_obra_id 
    FROM public.cronogramas c 
    WHERE c.id = COALESCE(NEW.cronograma_id, OLD.cronograma_id);
  ELSIF TG_TABLE_NAME = 'atividades' THEN
    v_obra_id := COALESCE(NEW.obra_id, OLD.obra_id);
  ELSIF TG_TABLE_NAME = 'user_obra_access' THEN
    v_obra_id := COALESCE(NEW.obra_id, OLD.obra_id);
  ELSIF TG_TABLE_NAME = 'anexos' THEN
    v_obra_id := COALESCE(NEW.obra_id, OLD.obra_id);
  ELSE
    v_obra_id := NULL;
  END IF;

  -- Calcular diff
  IF TG_OP = 'INSERT' THEN
    v_diff := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_diff := jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_diff := to_jsonb(OLD);
  END IF;

  -- Inserir registro de auditoria
  INSERT INTO public.auditoria (
    entidade,
    entidade_id,
    obra_id,
    acao,
    por_user_id,
    diff
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    v_obra_id,
    TG_OP::public.auditoria_acao,
    auth.uid(),
    v_diff
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Triggers de auditoria para cada tabela
CREATE TRIGGER audit_obras
  AFTER INSERT OR UPDATE OR DELETE ON public.obras
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

CREATE TRIGGER audit_obras_studio_info
  AFTER INSERT OR UPDATE OR DELETE ON public.obras_studio_info
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

CREATE TRIGGER audit_cronogramas
  AFTER INSERT OR UPDATE OR DELETE ON public.cronogramas
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

CREATE TRIGGER audit_marcos
  AFTER INSERT OR UPDATE OR DELETE ON public.marcos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

CREATE TRIGGER audit_atividades
  AFTER INSERT OR UPDATE OR DELETE ON public.atividades
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

CREATE TRIGGER audit_user_obra_access
  AFTER INSERT OR UPDATE OR DELETE ON public.user_obra_access
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

CREATE TRIGGER audit_anexos
  AFTER INSERT OR UPDATE OR DELETE ON public.anexos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- =====================================================
-- TRIGGER: Criar users_profile automaticamente
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_profile_v2()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users_profile (id, nome, email, perfil, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'customer'),
    'ativo'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para novos usuários
DROP TRIGGER IF EXISTS on_auth_user_created_profile_v2 ON auth.users;
CREATE TRIGGER on_auth_user_created_profile_v2
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile_v2();

-- =====================================================
-- STORAGE BUCKET: anexos
-- =====================================================

-- Criar bucket (se não existir)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'anexos',
  'anexos',
  false,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'video/mp4', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET 
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'video/mp4', 'video/quicktime'];

-- =====================================================
-- STORAGE POLICIES
-- =====================================================

-- Usuários com acesso à obra podem ler anexos
CREATE POLICY "read_anexos_bucket" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'anexos'
    AND (
      public.is_admin_v2()
      OR public.has_obra_access((storage.foldername(name))[1]::uuid)
    )
  );

-- Staff pode fazer upload de anexos para obras que tem acesso
CREATE POLICY "upload_anexos_bucket" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'anexos'
    AND (
      public.is_admin_v2()
      OR (
        public.has_obra_access((storage.foldername(name))[1]::uuid)
        AND public.get_effective_role((storage.foldername(name))[1]::uuid) NOT IN ('customer', 'cliente')
      )
    )
  );

-- Staff pode atualizar próprios anexos
CREATE POLICY "update_anexos_bucket" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'anexos'
    AND (
      public.is_admin_v2()
      OR (
        public.has_obra_access((storage.foldername(name))[1]::uuid)
        AND public.get_effective_role((storage.foldername(name))[1]::uuid) NOT IN ('customer', 'cliente')
      )
    )
  );

-- Admin ou uploader pode deletar
CREATE POLICY "delete_anexos_bucket" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'anexos'
    AND public.is_admin_v2()
  );