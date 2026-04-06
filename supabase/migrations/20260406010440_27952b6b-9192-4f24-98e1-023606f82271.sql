
-- Enum for budget internal status
CREATE TYPE public.orcamento_status AS ENUM (
  'requested', 'in_progress', 'review', 'waiting_info', 'blocked',
  'ready', 'sent_to_client', 'approved', 'rejected', 'cancelled'
);

CREATE TYPE public.orcamento_priority AS ENUM ('low', 'normal', 'high', 'urgent');

-- Main budgets table
CREATE TABLE public.orcamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  sequential_code TEXT,
  project_name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  property_type TEXT,
  city TEXT,
  bairro TEXT,
  metragem TEXT,
  condominio TEXT,
  unit TEXT,
  briefing TEXT,
  demand_context TEXT,
  internal_notes TEXT,
  reference_links TEXT[] DEFAULT '{}',
  internal_status public.orcamento_status NOT NULL DEFAULT 'requested',
  priority public.orcamento_priority NOT NULL DEFAULT 'normal',
  due_at TIMESTAMPTZ,
  commercial_owner_id UUID REFERENCES public.users_profile(id) ON DELETE SET NULL,
  estimator_owner_id UUID REFERENCES public.users_profile(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.users_profile(id) ON DELETE SET NULL,
  external_id TEXT,
  external_system TEXT DEFAULT 'envision',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_orcamentos_external ON public.orcamentos (external_id, external_system) WHERE external_id IS NOT NULL;

-- Sections
CREATE TABLE public.orcamento_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orcamento_id UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  section_price NUMERIC,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Items
CREATE TABLE public.orcamento_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID NOT NULL REFERENCES public.orcamento_sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  qty NUMERIC,
  unit TEXT,
  internal_unit_price NUMERIC,
  internal_total NUMERIC,
  bdi_percentage NUMERIC DEFAULT 0,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notes / comments
CREATE TABLE public.orcamento_notas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orcamento_id UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users_profile(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Events / history
CREATE TABLE public.orcamento_eventos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orcamento_id UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users_profile(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_orcamento_sections_orcamento ON public.orcamento_sections(orcamento_id);
CREATE INDEX idx_orcamento_items_section ON public.orcamento_items(section_id);
CREATE INDEX idx_orcamento_notas_orcamento ON public.orcamento_notas(orcamento_id);
CREATE INDEX idx_orcamento_eventos_orcamento ON public.orcamento_eventos(orcamento_id);
CREATE INDEX idx_orcamentos_project ON public.orcamentos(project_id);

-- RLS
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_eventos ENABLE ROW LEVEL SECURITY;

-- Staff roles can manage all budgets
CREATE POLICY "Staff can manage orcamentos" ON public.orcamentos
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'engineer') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'gestor') OR
    public.has_role(auth.uid(), 'cs')
  );

CREATE POLICY "Staff can manage orcamento_sections" ON public.orcamento_sections
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'engineer') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'gestor') OR
    public.has_role(auth.uid(), 'cs')
  );

CREATE POLICY "Staff can manage orcamento_items" ON public.orcamento_items
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'engineer') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'gestor') OR
    public.has_role(auth.uid(), 'cs')
  );

CREATE POLICY "Staff can manage orcamento_notas" ON public.orcamento_notas
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'engineer') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'gestor') OR
    public.has_role(auth.uid(), 'cs')
  );

CREATE POLICY "Staff can manage orcamento_eventos" ON public.orcamento_eventos
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'engineer') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'gestor') OR
    public.has_role(auth.uid(), 'cs')
  );

-- Updated_at trigger
CREATE TRIGGER update_orcamentos_updated_at
  BEFORE UPDATE ON public.orcamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
