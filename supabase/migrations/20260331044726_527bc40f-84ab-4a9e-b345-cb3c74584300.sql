
CREATE TABLE public.project_studio_info (
  project_id UUID PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  nome_do_empreendimento TEXT,
  endereco_completo TEXT,
  bairro TEXT,
  cidade TEXT,
  cep TEXT,
  complemento TEXT,
  tamanho_imovel_m2 NUMERIC,
  tipo_de_locacao TEXT,
  data_recebimento_chaves DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_studio_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage studio info"
  ON public.project_studio_info
  FOR ALL
  TO authenticated
  USING (public.has_project_access(auth.uid(), project_id))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Members can view studio info"
  ON public.project_studio_info
  FOR SELECT
  TO authenticated
  USING (public.has_project_access(auth.uid(), project_id));

CREATE TRIGGER update_project_studio_info_updated_at
  BEFORE UPDATE ON public.project_studio_info
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
