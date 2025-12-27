-- Create purchases table linked to project activities
CREATE TABLE public.project_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES public.project_activities(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'un',
  estimated_cost NUMERIC,
  supplier_name TEXT,
  supplier_contact TEXT,
  lead_time_days INTEGER NOT NULL DEFAULT 7,
  required_by_date DATE NOT NULL,
  order_date DATE,
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  invoice_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ordered', 'in_transit', 'delivered', 'cancelled')),
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_purchases ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users with project access can view purchases"
  ON public.project_purchases FOR SELECT
  USING (has_project_access(auth.uid(), project_id));

CREATE POLICY "Staff can manage purchases"
  ON public.project_purchases FOR ALL
  USING (is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id));

-- Indexes for performance
CREATE INDEX idx_project_purchases_project ON public.project_purchases(project_id);
CREATE INDEX idx_project_purchases_activity ON public.project_purchases(activity_id);
CREATE INDEX idx_project_purchases_status ON public.project_purchases(status);
CREATE INDEX idx_project_purchases_required_date ON public.project_purchases(required_by_date);

-- Trigger for updated_at
CREATE TRIGGER update_project_purchases_updated_at
  BEFORE UPDATE ON public.project_purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_project_updated_at();

-- Comment for documentation
COMMENT ON TABLE public.project_purchases IS 'Purchase items linked to project activities for procurement planning';