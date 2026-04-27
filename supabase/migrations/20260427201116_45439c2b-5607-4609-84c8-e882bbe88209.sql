ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS responsible_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reason TEXT;

CREATE INDEX IF NOT EXISTS idx_stock_movements_responsible
  ON public.stock_movements (responsible_user_id);