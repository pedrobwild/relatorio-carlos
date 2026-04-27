ALTER TABLE public.project_purchases
  DROP CONSTRAINT IF EXISTS chk_delivery_location;

ALTER TABLE public.project_purchases
  ADD CONSTRAINT chk_delivery_location
  CHECK (delivery_location IS NULL OR delivery_location IN ('obra', 'estoque', 'escritorio', 'retirada'));