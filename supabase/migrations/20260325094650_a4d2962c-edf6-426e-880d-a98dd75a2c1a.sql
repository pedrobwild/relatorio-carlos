
CREATE TABLE public.purchase_payment_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.project_purchases(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  installment_name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  due_date date,
  status text NOT NULL DEFAULT 'pendente',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_payment_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage payment flows"
  ON public.purchase_payment_flows FOR ALL
  TO public
  USING (is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id))
  WITH CHECK (is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id));

CREATE POLICY "Users with project access can view payment flows"
  ON public.purchase_payment_flows FOR SELECT
  TO public
  USING (has_project_access(auth.uid(), project_id));
