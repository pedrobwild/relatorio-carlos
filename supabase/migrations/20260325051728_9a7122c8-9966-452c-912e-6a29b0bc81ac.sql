
-- Fix log_pending_item_resolution to handle missing org gracefully
CREATE OR REPLACE FUNCTION public.log_pending_item_resolution()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Log domain event when pending item is resolved
  IF OLD.status = 'pending' AND NEW.status IN ('completed', 'cancelled') THEN
    -- Only log if org exists to avoid FK violation
    IF EXISTS (SELECT 1 FROM public.orgs WHERE id = NEW.customer_org_id) THEN
      INSERT INTO public.domain_events (
        org_id,
        project_id,
        entity_type,
        entity_id,
        event_type,
        payload,
        actor_user_id
      ) VALUES (
        NEW.customer_org_id,
        NEW.project_id,
        'pending_item',
        NEW.id,
        'pending_item.' || NEW.status,
        jsonb_build_object(
          'type', NEW.type,
          'title', NEW.title,
          'reference_type', NEW.reference_type,
          'reference_id', NEW.reference_id,
          'resolution_notes', NEW.resolution_notes,
          'resolution_payload', NEW.resolution_payload
        ),
        NEW.resolved_by
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Also fix resolve_payment_pending_item to be more resilient
CREATE OR REPLACE FUNCTION public.resolve_payment_pending_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- When payment is marked as paid, resolve the pending item
  IF OLD.paid_at IS NULL AND NEW.paid_at IS NOT NULL THEN
    BEGIN
      UPDATE public.pending_items
      SET 
        status = 'completed',
        resolved_at = now(),
        resolved_by = COALESCE(auth.uid(), NEW.project_id::text::uuid)
      WHERE 
        reference_type = 'payment' AND
        reference_id = NEW.id AND
        status = 'pending';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to resolve pending item for payment %: %', NEW.id, SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix create_payment_pending_item to use actual project org_id
CREATE OR REPLACE FUNCTION public.create_payment_pending_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
BEGIN
  -- Get org_id from project (use actual org_id, not created_by)
  SELECT COALESCE(p.org_id, p.created_by) INTO v_org_id
  FROM public.projects p
  WHERE p.id = NEW.project_id;

  -- Ensure org exists before inserting pending item
  IF v_org_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.orgs WHERE id = v_org_id) THEN
    INSERT INTO public.orgs (id, name)
    VALUES (v_org_id, 'Auto-created')
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
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
