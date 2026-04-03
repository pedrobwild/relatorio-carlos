
-- Table for supplier pricing items
CREATE TABLE public.fornecedor_precos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  unidade TEXT DEFAULT 'un',
  preco_unitario NUMERIC(12,2) NOT NULL,
  data_validade DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.fornecedor_precos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view supplier prices"
  ON public.fornecedor_precos FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can manage supplier prices"
  ON public.fornecedor_precos FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_fornecedor_precos_updated_at
  BEFORE UPDATE ON public.fornecedor_precos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table for supplier attachments
CREATE TABLE public.fornecedor_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  tipo TEXT DEFAULT 'outro',
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.fornecedor_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view supplier attachments"
  ON public.fornecedor_anexos FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can manage supplier attachments"
  ON public.fornecedor_anexos FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- Storage bucket for supplier attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('fornecedor-anexos', 'fornecedor-anexos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Staff can read supplier attachment files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'fornecedor-anexos' AND (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Staff can upload supplier attachment files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'fornecedor-anexos' AND (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Staff can delete supplier attachment files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'fornecedor-anexos' AND (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'admin')));
