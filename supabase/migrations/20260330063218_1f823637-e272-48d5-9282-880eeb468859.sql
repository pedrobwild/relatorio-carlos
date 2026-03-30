
-- 1. Create colaboradores table
CREATE TABLE public.colaboradores (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome TEXT NOT NULL,
  cargo TEXT,
  departamento TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  data_inicio DATE,
  data_desligamento DATE,
  motivo_desligamento TEXT,
  tipo_contrato TEXT,
  salario_base NUMERIC(12,2),
  carga_horaria TEXT,
  email_corporativo TEXT,
  email_pessoal TEXT,
  telefone TEXT,
  cpf TEXT,
  data_nascimento DATE,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  banco TEXT,
  agencia TEXT,
  conta TEXT,
  tipo_conta TEXT,
  chave_pix TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_colaborador_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('ativo', 'desligado') THEN
    RAISE EXCEPTION 'Status inválido: %. Valores permitidos: ativo, desligado', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_colaborador_status
  BEFORE INSERT OR UPDATE ON public.colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.validate_colaborador_status();

CREATE TRIGGER trg_colaboradores_updated_at
  BEFORE UPDATE ON public.colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "colaboradores_select" ON public.colaboradores FOR SELECT TO authenticated USING (true);
CREATE POLICY "colaboradores_insert" ON public.colaboradores FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "colaboradores_update" ON public.colaboradores FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "colaboradores_delete" ON public.colaboradores FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 2. Create beneficios_colaborador table
CREATE TABLE public.beneficios_colaborador (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id TEXT NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  valor NUMERIC(12,2),
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.beneficios_colaborador ENABLE ROW LEVEL SECURITY;

CREATE POLICY "beneficios_select" ON public.beneficios_colaborador FOR SELECT TO authenticated USING (true);
CREATE POLICY "beneficios_insert" ON public.beneficios_colaborador FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "beneficios_update" ON public.beneficios_colaborador FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "beneficios_delete" ON public.beneficios_colaborador FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3. Create politicas_comissao table
CREATE TABLE public.politicas_comissao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id TEXT NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  percentual NUMERIC(5,2),
  base_calculo TEXT,
  meta_mensal NUMERIC(12,2),
  observacoes TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trg_politicas_comissao_updated_at
  BEFORE UPDATE ON public.politicas_comissao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.politicas_comissao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comissao_select" ON public.politicas_comissao FOR SELECT TO authenticated USING (true);
CREATE POLICY "comissao_insert" ON public.politicas_comissao FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "comissao_update" ON public.politicas_comissao FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "comissao_delete" ON public.politicas_comissao FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4. Create politicas_veiculo table
CREATE TABLE public.politicas_veiculo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id TEXT NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  tem_direito BOOLEAN DEFAULT false,
  tipo TEXT,
  valor_km NUMERIC(6,3),
  teto_mensal NUMERIC(12,2),
  placa_veiculo TEXT,
  modelo_veiculo TEXT,
  observacoes TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.politicas_veiculo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "veiculo_select" ON public.politicas_veiculo FOR SELECT TO authenticated USING (true);
CREATE POLICY "veiculo_insert" ON public.politicas_veiculo FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "veiculo_update" ON public.politicas_veiculo FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "veiculo_delete" ON public.politicas_veiculo FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5. Create documentos_colaborador table
CREATE TABLE public.documentos_colaborador (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id TEXT NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  nome_arquivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  tamanho_bytes INTEGER,
  mime_type TEXT,
  descricao TEXT,
  data_documento DATE,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.documentos_colaborador ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docs_colab_select" ON public.documentos_colaborador FOR SELECT TO authenticated USING (true);
CREATE POLICY "docs_colab_insert" ON public.documentos_colaborador FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "docs_colab_update" ON public.documentos_colaborador FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "docs_colab_delete" ON public.documentos_colaborador FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 6. Create historico_cargos table
CREATE TABLE public.historico_cargos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id TEXT NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  cargo_anterior TEXT,
  cargo_novo TEXT NOT NULL,
  salario_anterior NUMERIC(12,2),
  salario_novo NUMERIC(12,2),
  data_mudanca DATE NOT NULL,
  motivo TEXT,
  aprovado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.historico_cargos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "historico_select" ON public.historico_cargos FOR SELECT TO authenticated USING (true);
CREATE POLICY "historico_insert" ON public.historico_cargos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "historico_update" ON public.historico_cargos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "historico_delete" ON public.historico_cargos FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 7. Storage bucket for HR documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documentos-rh', 'documentos-rh', false, 52428800, ARRAY['application/pdf','image/png','image/jpeg','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "documentos_rh_admin_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documentos-rh' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "documentos_rh_admin_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documentos-rh' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "documentos_rh_auth_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documentos-rh');
