-- =====================================================
-- MÓDULO ADMIN - PARTE 1: ESTRUTURA BASE
-- =====================================================

-- 1. Atualizar enum app_role para incluir novos perfis
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'suprimentos';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'financeiro';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gestor';

-- 2. Criar enum para status de obras
CREATE TYPE public.obra_status AS ENUM (
  'planejamento',
  'em_andamento',
  'pausada',
  'finalizada',
  'cancelada'
);

-- 3. Criar enum para status de atividades
CREATE TYPE public.atividade_status AS ENUM (
  'nao_iniciada',
  'em_andamento',
  'bloqueada',
  'concluida'
);

-- 4. Criar enum para prioridade
CREATE TYPE public.atividade_prioridade AS ENUM (
  'baixa',
  'media',
  'alta'
);

-- 5. Criar enum para status de marcos
CREATE TYPE public.marco_status AS ENUM (
  'pendente',
  'em_andamento',
  'concluido',
  'atrasado'
);

-- 6. Criar enum para tipos de entidade (anexos/auditoria)
CREATE TYPE public.entidade_tipo AS ENUM (
  'obra',
  'atividade',
  'marco',
  'cronograma'
);

-- 7. Criar enum para ações de auditoria
CREATE TYPE public.auditoria_acao AS ENUM (
  'create',
  'update',
  'delete'
);

-- 8. Criar enum para status de usuário
CREATE TYPE public.user_status AS ENUM (
  'ativo',
  'inativo'
);

-- =====================================================
-- TABELA: users_profile (perfil extendido)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.users_profile (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL UNIQUE,
  telefone text,
  empresa text,
  cargo text,
  perfil public.app_role NOT NULL DEFAULT 'customer',
  status public.user_status NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_users_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_users_profile_updated_at
  BEFORE UPDATE ON public.users_profile
  FOR EACH ROW
  EXECUTE FUNCTION public.update_users_profile_updated_at();

-- =====================================================
-- TABELA: obras
-- =====================================================
CREATE TABLE IF NOT EXISTS public.obras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_da_obra text NOT NULL,
  codigo_interno text,
  status public.obra_status NOT NULL DEFAULT 'planejamento',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE TRIGGER trigger_obras_updated_at
  BEFORE UPDATE ON public.obras
  FOR EACH ROW
  EXECUTE FUNCTION public.update_users_profile_updated_at();

-- =====================================================
-- TABELA: obras_studio_info
-- =====================================================
CREATE TABLE IF NOT EXISTS public.obras_studio_info (
  obra_id uuid PRIMARY KEY REFERENCES public.obras(id) ON DELETE CASCADE,
  tipo_de_locacao text,
  nome_do_empreendimento text,
  endereco_completo_do_studio text,
  complemento text,
  cep text,
  bairro text,
  cidade text,
  tamanho_do_imovel_m2 numeric,
  data_de_recebimento_das_chaves date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE TRIGGER trigger_obras_studio_info_updated_at
  BEFORE UPDATE ON public.obras_studio_info
  FOR EACH ROW
  EXECUTE FUNCTION public.update_users_profile_updated_at();

-- =====================================================
-- TABELA: user_obra_access (escopo por obra)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_obra_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  role_override public.app_role,
  permissoes_especificas jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, obra_id)
);

-- =====================================================
-- TABELA: cronogramas
-- =====================================================
CREATE TABLE IF NOT EXISTS public.cronogramas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  data_inicio date NOT NULL,
  data_fim_prevista date NOT NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE TRIGGER trigger_cronogramas_updated_at
  BEFORE UPDATE ON public.cronogramas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_users_profile_updated_at();

-- =====================================================
-- TABELA: marcos
-- =====================================================
CREATE TABLE IF NOT EXISTS public.marcos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cronograma_id uuid NOT NULL REFERENCES public.cronogramas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  data_prevista date NOT NULL,
  data_real date,
  status public.marco_status NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE TRIGGER trigger_marcos_updated_at
  BEFORE UPDATE ON public.marcos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_users_profile_updated_at();

-- =====================================================
-- TABELA: atividades (novo modelo)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  etapa text,
  titulo text NOT NULL,
  descricao text,
  responsavel_user_id uuid REFERENCES public.users_profile(id) ON DELETE SET NULL,
  data_prevista_inicio date,
  data_prevista_fim date,
  data_real_inicio date,
  data_real_fim date,
  status public.atividade_status NOT NULL DEFAULT 'nao_iniciada',
  prioridade public.atividade_prioridade NOT NULL DEFAULT 'media',
  dependencias uuid[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE TRIGGER trigger_atividades_updated_at
  BEFORE UPDATE ON public.atividades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_users_profile_updated_at();

-- =====================================================
-- TABELA: anexos
-- =====================================================
CREATE TABLE IF NOT EXISTS public.anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade_tipo public.entidade_tipo NOT NULL,
  entidade_id uuid NOT NULL,
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid NOT NULL REFERENCES public.users_profile(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index para busca por entidade
CREATE INDEX idx_anexos_entidade ON public.anexos(entidade_tipo, entidade_id);

-- =====================================================
-- TABELA: auditoria
-- =====================================================
CREATE TABLE IF NOT EXISTS public.auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade text NOT NULL,
  entidade_id uuid NOT NULL,
  obra_id uuid,
  acao public.auditoria_acao NOT NULL,
  por_user_id uuid REFERENCES public.users_profile(id) ON DELETE SET NULL,
  diff jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes para auditoria
CREATE INDEX idx_auditoria_entidade ON public.auditoria(entidade, entidade_id);
CREATE INDEX idx_auditoria_obra ON public.auditoria(obra_id);
CREATE INDEX idx_auditoria_user ON public.auditoria(por_user_id);
CREATE INDEX idx_auditoria_created ON public.auditoria(created_at DESC);

-- =====================================================
-- FUNÇÕES AUXILIARES
-- =====================================================

-- Função para verificar se usuário é admin
CREATE OR REPLACE FUNCTION public.is_admin_v2()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users_profile
    WHERE id = auth.uid()
      AND perfil = 'admin'
      AND status = 'ativo'
  )
$$;

-- Função para verificar acesso a uma obra
CREATE OR REPLACE FUNCTION public.has_obra_access(p_obra_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.is_admin_v2() 
    OR EXISTS (
      SELECT 1 FROM public.user_obra_access uoa
      JOIN public.users_profile up ON up.id = uoa.user_id
      WHERE uoa.user_id = auth.uid()
        AND uoa.obra_id = p_obra_id
        AND up.status = 'ativo'
    )
$$;

-- Função para obter o perfil do usuário atual
CREATE OR REPLACE FUNCTION public.my_profile_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT perfil::text FROM public.users_profile
  WHERE id = auth.uid()
$$;

-- Função para obter role efetivo em uma obra (considerando override)
CREATE OR REPLACE FUNCTION public.get_effective_role(p_obra_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role_override::text FROM public.user_obra_access 
     WHERE user_id = auth.uid() AND obra_id = p_obra_id),
    (SELECT perfil::text FROM public.users_profile WHERE id = auth.uid())
  )
$$;

-- Função para verificar se usuário pode editar atividades
CREATE OR REPLACE FUNCTION public.can_edit_atividades(p_obra_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_v2() 
    OR (
      public.has_obra_access(p_obra_id) 
      AND public.get_effective_role(p_obra_id) IN ('admin', 'engenheiro', 'engineer', 'gestor', 'manager')
    )
$$;

-- Função para verificar se usuário pode editar cronograma/marcos
CREATE OR REPLACE FUNCTION public.can_edit_cronograma(p_obra_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_v2() 
    OR (
      public.has_obra_access(p_obra_id) 
      AND public.get_effective_role(p_obra_id) IN ('admin', 'gestor', 'manager')
    )
$$;

-- Função para verificar se usuário é apenas leitura (cliente)
CREATE OR REPLACE FUNCTION public.is_read_only(p_obra_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_effective_role(p_obra_id) IN ('customer', 'cliente')
$$;

-- Função para verificar status ativo
CREATE OR REPLACE FUNCTION public.is_user_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users_profile
    WHERE id = auth.uid()
      AND status = 'ativo'
  )
$$;

-- =====================================================
-- ENABLE RLS EM TODAS AS TABELAS
-- =====================================================
ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obras_studio_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_obra_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cronogramas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marcos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;