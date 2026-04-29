ALTER TABLE public.project_purchases 
ADD COLUMN IF NOT EXISTS paid_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_project_purchases_paid_at 
ON public.project_purchases(paid_at) 
WHERE paid_at IS NOT NULL;