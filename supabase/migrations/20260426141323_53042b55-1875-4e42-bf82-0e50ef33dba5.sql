ALTER TABLE public.project_purchases
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS pix_key text,
  ADD COLUMN IF NOT EXISTS boleto_file_path text,
  ADD COLUMN IF NOT EXISTS boleto_code text;

ALTER TABLE public.project_purchases
  DROP CONSTRAINT IF EXISTS chk_payment_method;

ALTER TABLE public.project_purchases
  ADD CONSTRAINT chk_payment_method
  CHECK (payment_method IS NULL OR payment_method IN ('pix','boleto','transferencia','cartao','dinheiro','outro'));