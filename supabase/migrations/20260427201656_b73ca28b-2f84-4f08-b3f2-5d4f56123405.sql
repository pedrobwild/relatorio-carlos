ALTER TABLE public.stock_items
  ADD COLUMN IF NOT EXISTS min_quantity NUMERIC(14,3);