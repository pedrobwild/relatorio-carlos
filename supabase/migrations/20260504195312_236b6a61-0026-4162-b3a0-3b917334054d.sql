ALTER TABLE public.fornecedores DROP CONSTRAINT IF EXISTS fornecedores_status_check;
ALTER TABLE public.fornecedores ADD CONSTRAINT fornecedores_status_check
  CHECK (status = ANY (ARRAY['ativo'::text, 'inativo'::text, 'rascunho'::text]));