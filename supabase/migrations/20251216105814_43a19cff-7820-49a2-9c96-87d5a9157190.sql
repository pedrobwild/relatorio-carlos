-- Create enum types for pending items
CREATE TYPE public.pending_item_type AS ENUM (
  'approve_3d',
  'approve_executive',
  'signature',
  'decision',
  'invoice',
  'extra_purchase'
);

CREATE TYPE public.pending_item_status AS ENUM (
  'pending',
  'completed',
  'cancelled'
);

-- Create pending_items table
CREATE TABLE public.pending_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  customer_org_id UUID NOT NULL,
  type public.pending_item_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  
  -- Reference to source entity
  reference_type TEXT, -- 'formalization', 'payment', 'document', 'weekly_report'
  reference_id UUID,
  
  -- Decision-specific fields (JSONB for options array)
  options JSONB DEFAULT '[]'::jsonb,
  impact TEXT,
  
  -- Payment-specific fields
  amount NUMERIC,
  
  -- SLA/Deadline
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Resolution tracking
  status public.pending_item_status NOT NULL DEFAULT 'pending',
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,
  
  -- Direct action link
  action_url TEXT
);

-- Enable RLS
ALTER TABLE public.pending_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view pending items for their organization
CREATE POLICY "pending_items_select_policy" ON public.pending_items
FOR SELECT USING (
  user_belongs_to_org(auth.uid(), customer_org_id)
);

-- Staff can create pending items
CREATE POLICY "pending_items_insert_policy" ON public.pending_items
FOR INSERT WITH CHECK (
  user_is_staff_or_above(auth.uid()) AND
  user_belongs_to_org(auth.uid(), customer_org_id)
);

-- Staff can update pending items, customers can only resolve their own
CREATE POLICY "pending_items_update_policy" ON public.pending_items
FOR UPDATE USING (
  user_belongs_to_org(auth.uid(), customer_org_id) AND
  (user_is_staff_or_above(auth.uid()) OR status = 'pending')
);

-- Only staff can delete pending items
CREATE POLICY "pending_items_delete_policy" ON public.pending_items
FOR DELETE USING (
  user_is_staff_or_above(auth.uid()) AND
  user_belongs_to_org(auth.uid(), customer_org_id)
);

-- Create index for common queries
CREATE INDEX idx_pending_items_project ON public.pending_items(project_id);
CREATE INDEX idx_pending_items_status ON public.pending_items(status);
CREATE INDEX idx_pending_items_due_date ON public.pending_items(due_date);
CREATE INDEX idx_pending_items_org ON public.pending_items(customer_org_id);

-- Function to create pending item when formalization is sent for signature
CREATE OR REPLACE FUNCTION public.create_signature_pending_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id UUID;
BEGIN
  -- Only trigger when status changes to pending_signatures
  IF OLD.status != 'pending_signatures' AND NEW.status = 'pending_signatures' THEN
    -- Get project_id from formalization
    v_project_id := NEW.project_id;
    
    -- Create pending item for signature
    INSERT INTO public.pending_items (
      project_id,
      customer_org_id,
      type,
      title,
      description,
      reference_type,
      reference_id,
      due_date,
      action_url
    ) VALUES (
      v_project_id,
      NEW.customer_org_id,
      'signature',
      'Assinatura pendente: ' || NEW.title,
      NEW.summary,
      'formalization',
      NEW.id,
      CURRENT_DATE + INTERVAL '5 days',
      '/obra/' || v_project_id || '/formalizacao/' || NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for formalization signature pending items
CREATE TRIGGER on_formalization_sent_for_signature
  AFTER UPDATE ON public.formalizations
  FOR EACH ROW
  EXECUTE FUNCTION public.create_signature_pending_item();

-- Function to create pending item when payment is created
CREATE OR REPLACE FUNCTION public.create_payment_pending_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Get customer_org_id from project
  SELECT p.created_by INTO v_org_id
  FROM public.projects p
  WHERE p.id = NEW.project_id;
  
  -- For now, use the project's created_by as org reference
  -- In production, you'd have a proper org lookup
  
  INSERT INTO public.pending_items (
    project_id,
    customer_org_id,
    type,
    title,
    description,
    reference_type,
    reference_id,
    amount,
    due_date,
    action_url
  ) VALUES (
    NEW.project_id,
    COALESCE(v_org_id, gen_random_uuid()),
    'invoice',
    'Pagamento: ' || NEW.description,
    'Parcela ' || NEW.installment_number,
    'payment',
    NEW.id,
    NEW.amount,
    NEW.due_date,
    '/obra/' || NEW.project_id || '/financeiro'
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for payment pending items
CREATE TRIGGER on_payment_created
  AFTER INSERT ON public.project_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.create_payment_pending_item();

-- Function to mark pending item as resolved when formalization is signed
CREATE OR REPLACE FUNCTION public.resolve_signature_pending_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When formalization becomes signed, resolve the pending item
  IF OLD.status != 'signed' AND NEW.status = 'signed' THEN
    UPDATE public.pending_items
    SET 
      status = 'completed',
      resolved_at = now(),
      resolved_by = auth.uid()
    WHERE 
      reference_type = 'formalization' AND
      reference_id = NEW.id AND
      status = 'pending';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-resolve signature pending items
CREATE TRIGGER on_formalization_signed
  AFTER UPDATE ON public.formalizations
  FOR EACH ROW
  EXECUTE FUNCTION public.resolve_signature_pending_item();

-- Function to mark payment pending item as resolved when paid
CREATE OR REPLACE FUNCTION public.resolve_payment_pending_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When payment is marked as paid, resolve the pending item
  IF OLD.paid_at IS NULL AND NEW.paid_at IS NOT NULL THEN
    UPDATE public.pending_items
    SET 
      status = 'completed',
      resolved_at = now(),
      resolved_by = auth.uid()
    WHERE 
      reference_type = 'payment' AND
      reference_id = NEW.id AND
      status = 'pending';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-resolve payment pending items
CREATE TRIGGER on_payment_paid
  AFTER UPDATE ON public.project_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.resolve_payment_pending_item();