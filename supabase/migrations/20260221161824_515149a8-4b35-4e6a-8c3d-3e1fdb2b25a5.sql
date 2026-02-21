
-- ============================================================
-- P0: Fix duplicate triggers & add idempotency constraints
-- ============================================================

-- 1. Remove duplicate triggers on project_payments
DROP TRIGGER IF EXISTS on_payment_created ON public.project_payments;
DROP TRIGGER IF EXISTS on_payment_paid ON public.project_payments;
DROP TRIGGER IF EXISTS resolve_payment_pending_item_trigger ON public.project_payments;

-- 2. Clean ALL existing duplicate pending_items first (keep oldest, delete newer dupes)
DELETE FROM public.pending_items
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY reference_type, reference_id 
      ORDER BY created_at ASC
    ) as rn
    FROM public.pending_items
    WHERE status = 'pending'
      AND reference_type IS NOT NULL
      AND reference_id IS NOT NULL
  ) dupes
  WHERE rn > 1
);

-- 3. Now create unique partial index (no more dupes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_items_unique_reference 
ON public.pending_items (reference_type, reference_id) 
WHERE status = 'pending';

-- 4. Make create_signature_pending_item idempotent with ON CONFLICT
CREATE OR REPLACE FUNCTION public.create_signature_pending_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id UUID;
BEGIN
  IF OLD.status <> 'pending_signatures' AND NEW.status = 'pending_signatures' THEN
    v_project_id := NEW.project_id;
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
      CURRENT_DATE + 5,
      '/obra/' || v_project_id || '/formalizacoes/' || NEW.id
    )
    ON CONFLICT (reference_type, reference_id) WHERE status = 'pending'
    DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- 5. Make create_payment_pending_item idempotent
CREATE OR REPLACE FUNCTION public.create_payment_pending_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT p.created_by INTO v_org_id
  FROM public.projects p
  WHERE p.id = NEW.project_id;
  
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
  )
  ON CONFLICT (reference_type, reference_id) WHERE status = 'pending'
  DO NOTHING;
  
  RETURN NEW;
END;
$function$;
