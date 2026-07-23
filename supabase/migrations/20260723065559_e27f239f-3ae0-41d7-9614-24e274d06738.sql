
-- Requisições
CREATE TABLE public.material_requisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  needed_by date,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','aberta','em_cotacao','pedido_emitido','atendida','cancelada')),
  notes text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_requisitions TO authenticated;
GRANT ALL ON public.material_requisitions TO service_role;
ALTER TABLE public.material_requisitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage requisitions" ON public.material_requisitions
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX idx_material_requisitions_project ON public.material_requisitions(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_material_requisitions_status ON public.material_requisitions(status) WHERE deleted_at IS NULL;
CREATE TRIGGER update_material_requisitions_updated_at BEFORE UPDATE ON public.material_requisitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Itens
CREATE TABLE public.material_requisition_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id uuid NOT NULL REFERENCES public.material_requisitions(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 1,
  unidade text NOT NULL DEFAULT 'un',
  categoria text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_requisition_items TO authenticated;
GRANT ALL ON public.material_requisition_items TO service_role;
ALTER TABLE public.material_requisition_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage requisition items" ON public.material_requisition_items
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX idx_material_requisition_items_req ON public.material_requisition_items(requisition_id);
CREATE TRIGGER update_material_requisition_items_updated_at BEFORE UPDATE ON public.material_requisition_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cotações
CREATE TABLE public.requisition_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id uuid NOT NULL REFERENCES public.material_requisitions(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  valor_total numeric,
  prazo_entrega_dias integer,
  frete numeric,
  validade date,
  observacao text,
  arquivo_path text,
  is_winner boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requisition_quotes TO authenticated;
GRANT ALL ON public.requisition_quotes TO service_role;
ALTER TABLE public.requisition_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage requisition quotes" ON public.requisition_quotes
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX idx_requisition_quotes_req ON public.requisition_quotes(requisition_id);
CREATE UNIQUE INDEX uq_requisition_quotes_winner ON public.requisition_quotes(requisition_id) WHERE is_winner = true;
CREATE TRIGGER update_requisition_quotes_updated_at BEFORE UPDATE ON public.requisition_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vínculo com pedido
ALTER TABLE public.project_purchases
  ADD COLUMN IF NOT EXISTS requisition_id uuid REFERENCES public.material_requisitions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_project_purchases_requisition ON public.project_purchases(requisition_id);
