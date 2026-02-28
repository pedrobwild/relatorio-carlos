
-- ============================================================
-- 1) FEATURE FLAGS - DB-backed feature toggle system
-- ============================================================
CREATE TABLE public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read flags (they're config, not sensitive data)
CREATE POLICY "Authenticated users can read feature flags"
  ON public.feature_flags FOR SELECT TO authenticated USING (true);

-- Only admins can manage flags
CREATE POLICY "Admins can manage feature flags"
  ON public.feature_flags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default flags
INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('enableListViewWorks', false, 'Habilita visualização em lista para obras'),
  ('enableBulkActions', false, 'Habilita ações em lote (ex: ativar/desativar múltiplos usuários)'),
  ('enableInvitations', false, 'Habilita sistema de convites por e-mail'),
  ('enableAdvancedFilters', false, 'Habilita filtros avançados em listagens'),
  ('enableDocumentReviews', false, 'Habilita ciclos de revisão de documentos com comentários ancorados');

-- ============================================================
-- 2) INVITATIONS - Convites por e-mail para o sistema
-- ============================================================
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');

CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'customer',
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  project_role project_role,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  status invitation_status NOT NULL DEFAULT 'pending',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Staff can see and manage invitations
CREATE POLICY "Staff can view invitations"
  ON public.invitations FOR SELECT TO authenticated
  USING (public.user_is_staff_or_above(auth.uid()));

CREATE POLICY "Staff can create invitations"
  ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (public.user_is_staff_or_above(auth.uid()) AND invited_by = auth.uid());

CREATE POLICY "Staff can update invitations"
  ON public.invitations FOR UPDATE TO authenticated
  USING (public.user_is_staff_or_above(auth.uid()));

CREATE TRIGGER update_invitations_updated_at
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for lookup by email/token
CREATE INDEX idx_invitations_email ON public.invitations(email);
CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_status ON public.invitations(status);

-- ============================================================
-- 3) PROJECT MEMBER PERMISSIONS - Granular per-project overrides
-- ============================================================
CREATE TABLE public.project_member_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT true,
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id, permission)
);

ALTER TABLE public.project_member_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own project permissions"
  ON public.project_member_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.user_is_staff_or_above(auth.uid()));

CREATE POLICY "Staff can manage project permissions"
  ON public.project_member_permissions FOR ALL TO authenticated
  USING (public.user_is_staff_or_above(auth.uid()))
  WITH CHECK (public.user_is_staff_or_above(auth.uid()));

CREATE INDEX idx_pmp_user_project ON public.project_member_permissions(user_id, project_id);

-- ============================================================
-- 4) HELPER FUNCTION - Check project-scoped permission
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_project_permission(
  _user_id UUID, _project_id UUID, _permission TEXT
)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_member_permissions
    WHERE user_id = _user_id
      AND project_id = _project_id
      AND permission = _permission
      AND granted = true
  )
$$;

-- ============================================================
-- 5) AUDIT ENHANCEMENTS - Add indexes for better query perf
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_auditoria_entidade ON public.auditoria(entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_created_at ON public.auditoria(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_por_user ON public.auditoria(por_user_id);
CREATE INDEX IF NOT EXISTS idx_domain_events_project ON public.domain_events(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_domain_events_entity ON public.domain_events(entity_type, entity_id);
