
CREATE TABLE public.purchase_payment_schedule (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id uuid NOT NULL REFERENCES public.project_purchases(id) ON DELETE CASCADE,
  installment_number integer NOT NULL DEFAULT 1,
  description text NOT NULL DEFAULT '',
  percentage numeric(5,2),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  due_date date,
  paid_at timestamp with time zone,
  payment_method text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_purchase_payment_schedule_purchase_id ON public.purchase_payment_schedule(purchase_id);

ALTER TABLE public.purchase_payment_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage purchase payment schedules"
ON public.purchase_payment_schedule
FOR ALL
TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER update_purchase_payment_schedule_updated_at
BEFORE UPDATE ON public.purchase_payment_schedule
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
