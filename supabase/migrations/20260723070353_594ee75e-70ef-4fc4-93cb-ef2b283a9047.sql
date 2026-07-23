
CREATE TABLE public.purchase_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.project_purchases(id) ON DELETE CASCADE,
  received_on date NOT NULL DEFAULT current_date,
  quantidade numeric,
  valor numeric,
  notes text,
  photo_path text,
  received_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_purchase_receipts_purchase
  ON public.purchase_receipts(purchase_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_purchase_receipts_received_on
  ON public.purchase_receipts(received_on)
  WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_receipts TO authenticated;
GRANT ALL ON public.purchase_receipts TO service_role;

ALTER TABLE public.purchase_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view purchase receipts"
  ON public.purchase_receipts
  FOR SELECT
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert purchase receipts"
  ON public.purchase_receipts
  FOR INSERT
  WITH CHECK (public.is_staff(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Staff can update purchase receipts"
  ON public.purchase_receipts
  FOR UPDATE
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete purchase receipts"
  ON public.purchase_receipts
  FOR DELETE
  USING (public.is_staff(auth.uid()));

CREATE TRIGGER trg_purchase_receipts_updated_at
  BEFORE UPDATE ON public.purchase_receipts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
