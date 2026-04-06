-- Add purchase_type and delivery_address to project_purchases
ALTER TABLE public.project_purchases
ADD COLUMN purchase_type text DEFAULT 'produto'
  CHECK (purchase_type IN ('produto', 'prestador'));

ALTER TABLE public.project_purchases
ADD COLUMN delivery_address text;

-- Index for filtering by type
CREATE INDEX idx_project_purchases_type ON public.project_purchases (purchase_type);

-- Backfill existing rows: infer type from category using supplier taxonomy
-- Prestador subcategories
UPDATE public.project_purchases
SET purchase_type = 'prestador'
WHERE category IN (
  'Marcenaria', 'Empreita', 'Vidraçaria Box', 'Vidraçaria Sacada',
  'Eletricista', 'Pintor', 'Instalador de Piso', 'Técnico Ar-Condicionado',
  'Gesseiro', 'Serviços Gerais', 'Limpeza', 'Pedreiro',
  'Instalador Fechadura Digital', 'Cortinas', 'Marmoraria', 'Jardim Vertical'
);

-- Product subcategories (already defaulted to 'produto')
UPDATE public.project_purchases
SET purchase_type = 'produto'
WHERE purchase_type IS NULL OR category IN (
  'Eletrodomésticos', 'Enxoval', 'Espelhos', 'Decoração', 'Revestimentos',
  'Luminárias', 'Torneiras', 'Cadeiras e Mesas', 'Camas', 'Sofás e Poltronas',
  'Tapeçaria', 'Torneiras e Cubas', 'Materiais Elétricos', 'Materiais de Construção',
  'Acessórios Banheiro', 'Fechadura Digital', 'Tintas'
);