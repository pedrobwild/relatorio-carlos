-- Fix the create_document_approval_pending_item function to use correct enum value
CREATE OR REPLACE FUNCTION public.create_document_approval_pending_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_pending_type pending_item_type;
BEGIN
  -- Only create pending item for documents requiring approval
  IF NEW.status = 'pending' AND NEW.document_type IN ('projeto_3d', 'projeto_executivo', 'plano_reforma') THEN
    -- Get org_id from project
    SELECT org_id INTO v_org_id FROM public.projects WHERE id = NEW.project_id;
    
    -- Map document type to pending item type
    IF NEW.document_type = 'projeto_3d' THEN
      v_pending_type := 'approve_3d';
    ELSIF NEW.document_type = 'projeto_executivo' THEN
      v_pending_type := 'approve_executive';
    ELSE
      -- For plano_reforma, use approve_3d as fallback (or skip)
      v_pending_type := 'approve_3d';
    END IF;
    
    INSERT INTO public.pending_items (
      project_id,
      customer_org_id,
      type,
      title,
      description,
      due_date,
      reference_type,
      reference_id,
      action_url
    ) VALUES (
      NEW.project_id,
      COALESCE(v_org_id, gen_random_uuid()),
      v_pending_type,
      'Aprovação pendente: ' || NEW.name,
      'Documento ' || NEW.document_type || ' aguardando aprovação do cliente',
      CURRENT_DATE + INTERVAL '5 days',
      'document',
      NEW.id,
      '/obra/' || NEW.project_id || '/documentos'
    );
  END IF;
  
  RETURN NEW;
END;
$function$;