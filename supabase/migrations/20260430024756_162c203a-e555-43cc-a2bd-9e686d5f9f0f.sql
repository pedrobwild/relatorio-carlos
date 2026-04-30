ALTER TABLE public.project_purchases
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(14,2);

COMMENT ON COLUMN public.project_purchases.paid_amount IS
  'Valor acumulado pago da compra. Quando há parcelas em purchase_payment_schedule com paid_at, esse campo deve ser ignorado em favor da soma das parcelas pagas (regra híbrida).';