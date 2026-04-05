-- Add new taxonomy columns (nullable for legacy compatibility)
ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS supplier_type text,
  ADD COLUMN IF NOT EXISTS supplier_subcategory text;

-- Create index for future filtering
CREATE INDEX IF NOT EXISTS idx_fornecedores_supplier_type ON public.fornecedores (supplier_type);

-- Migrate existing data where we can reasonably infer the type
UPDATE public.fornecedores
SET supplier_type = CASE
  WHEN categoria IN ('mao_de_obra', 'servicos') THEN 'prestadores'
  WHEN categoria IN ('materiais', 'equipamentos') THEN 'produtos'
  ELSE NULL
END
WHERE supplier_type IS NULL;