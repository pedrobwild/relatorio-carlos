ALTER TABLE public.project_purchases
ADD COLUMN IF NOT EXISTS payment_due_date date;

COMMENT ON COLUMN public.project_purchases.payment_due_date IS 'Data prevista para o pagamento da compra ao fornecedor';

CREATE INDEX IF NOT EXISTS idx_project_purchases_payment_due_date
  ON public.project_purchases(payment_due_date);