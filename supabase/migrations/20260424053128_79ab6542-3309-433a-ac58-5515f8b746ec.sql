ALTER TABLE public.project_payments
ADD COLUMN IF NOT EXISTS pix_key text,
ADD COLUMN IF NOT EXISTS boleto_code text;

COMMENT ON COLUMN public.project_payments.pix_key IS 'Chave PIX para recebimento da parcela';
COMMENT ON COLUMN public.project_payments.boleto_code IS 'Linha digitável do boleto (47 dígitos)';