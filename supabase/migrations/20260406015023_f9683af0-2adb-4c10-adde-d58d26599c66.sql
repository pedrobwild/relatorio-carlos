ALTER TABLE public.orcamento_items
  ADD COLUMN IF NOT EXISTS item_category text,
  ADD COLUMN IF NOT EXISTS supplier_id text,
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS catalog_item_id text;

COMMENT ON COLUMN public.orcamento_items.item_category IS 'Categoria: produto ou prestador';
COMMENT ON COLUMN public.orcamento_items.supplier_id IS 'ID do fornecedor no Envision';
COMMENT ON COLUMN public.orcamento_items.supplier_name IS 'Nome do fornecedor no Envision';
COMMENT ON COLUMN public.orcamento_items.catalog_item_id IS 'ID do item no catalogo mestre do Envision';