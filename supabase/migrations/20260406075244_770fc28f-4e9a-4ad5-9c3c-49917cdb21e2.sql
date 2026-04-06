
-- Add product tracking columns to project_purchases
ALTER TABLE public.project_purchases
  ADD COLUMN IF NOT EXISTS delivery_location text,
  ADD COLUMN IF NOT EXISTS stock_entry_date date,
  ADD COLUMN IF NOT EXISTS stock_exit_date date,
  ADD COLUMN IF NOT EXISTS shipping_cost numeric,
  ADD COLUMN IF NOT EXISTS invoice_file_path text;

-- Add constraint for delivery_location values
ALTER TABLE public.project_purchases
  ADD CONSTRAINT chk_delivery_location CHECK (delivery_location IS NULL OR delivery_location IN ('obra', 'estoque'));
