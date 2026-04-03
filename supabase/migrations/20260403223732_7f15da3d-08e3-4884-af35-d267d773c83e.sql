
-- Enum for supplier category
CREATE TYPE public.supplier_category AS ENUM ('materiais', 'mao_de_obra', 'servicos', 'equipamentos', 'outros');

-- Suppliers table
CREATE TABLE public.fornecedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  razao_social TEXT,
  cnpj_cpf TEXT,
  categoria supplier_category NOT NULL DEFAULT 'outros',
  telefone TEXT,
  email TEXT,
  site TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  endereco TEXT,
  produtos_servicos TEXT,
  condicoes_pagamento TEXT,
  prazo_entrega_dias INTEGER,
  nota_avaliacao NUMERIC(2,1) CHECK (nota_avaliacao >= 0 AND nota_avaliacao <= 5),
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

-- Staff can view
CREATE POLICY "Staff can view suppliers"
ON public.fornecedores FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()) OR public.is_admin_v2());

-- Staff can insert
CREATE POLICY "Staff can insert suppliers"
ON public.fornecedores FOR INSERT
TO authenticated
WITH CHECK (public.is_staff(auth.uid()) OR public.is_admin_v2());

-- Staff can update
CREATE POLICY "Staff can update suppliers"
ON public.fornecedores FOR UPDATE
TO authenticated
USING (public.is_staff(auth.uid()) OR public.is_admin_v2());

-- Admin can delete
CREATE POLICY "Admin can delete suppliers"
ON public.fornecedores FOR DELETE
TO authenticated
USING (public.is_admin_v2());

-- Timestamp trigger
CREATE TRIGGER update_fornecedores_updated_at
BEFORE UPDATE ON public.fornecedores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for search
CREATE INDEX idx_fornecedores_nome ON public.fornecedores (nome);
CREATE INDEX idx_fornecedores_categoria ON public.fornecedores (categoria);
CREATE INDEX idx_fornecedores_status ON public.fornecedores (status);
