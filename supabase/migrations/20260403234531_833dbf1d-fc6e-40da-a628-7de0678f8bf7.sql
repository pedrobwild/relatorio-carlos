
-- Add fornecedor_id to project_purchases
ALTER TABLE public.project_purchases
ADD COLUMN fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX idx_project_purchases_fornecedor_id ON public.project_purchases(fornecedor_id);
