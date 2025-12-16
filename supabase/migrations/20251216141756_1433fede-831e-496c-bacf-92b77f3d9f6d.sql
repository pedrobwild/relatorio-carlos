-- Add resolution_payload column to pending_items for structured resolution data
ALTER TABLE public.pending_items 
ADD COLUMN IF NOT EXISTS resolution_payload jsonb DEFAULT '{}'::jsonb;

-- Create index for faster queries on common filters
CREATE INDEX IF NOT EXISTS idx_pending_items_project_status ON public.pending_items(project_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_items_due_date ON public.pending_items(due_date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_pending_items_type ON public.pending_items(type);

-- Function to create pending item for client decisions from weekly reports
CREATE OR REPLACE FUNCTION public.create_decision_pending_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_decision jsonb;
  v_org_id UUID;
BEGIN
  -- Get org_id from project
  SELECT org_id INTO v_org_id FROM public.projects WHERE id = NEW.project_id;
  
  -- If the report has client_decisions in data, create pending items for each
  IF NEW.data ? 'clientDecisions' AND jsonb_array_length(NEW.data->'clientDecisions') > 0 THEN
    FOR v_decision IN SELECT * FROM jsonb_array_elements(NEW.data->'clientDecisions')
    LOOP
      INSERT INTO public.pending_items (
        project_id,
        customer_org_id,
        type,
        title,
        description,
        options,
        impact,
        due_date,
        reference_type,
        reference_id,
        action_url
      ) VALUES (
        NEW.project_id,
        COALESCE(v_org_id, gen_random_uuid()),
        'decision',
        'Decisão pendente: ' || COALESCE(v_decision->>'decision', 'Sem título'),
        v_decision->>'decision',
        COALESCE(v_decision->'options', '[]'::jsonb),
        v_decision->>'impactIfDelayed',
        COALESCE((v_decision->>'requiredByDate')::date, CURRENT_DATE + INTERVAL '7 days'),
        'weekly_report',
        NEW.id,
        '/obra/' || NEW.project_id || '/relatorio'
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to create pending item for document approval
CREATE OR REPLACE FUNCTION public.create_document_approval_pending_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Only create pending item for documents requiring approval
  IF NEW.status = 'pending' AND NEW.document_type IN ('projeto_3d', 'projeto_executivo', 'plano_reforma') THEN
    -- Get org_id from project
    SELECT org_id INTO v_org_id FROM public.projects WHERE id = NEW.project_id;
    
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
      'approval',
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
$$;

-- Function to resolve document approval pending item
CREATE OR REPLACE FUNCTION public.resolve_document_approval_pending_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When document is approved, resolve the pending item
  IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
    UPDATE public.pending_items
    SET 
      status = 'completed',
      resolved_at = now(),
      resolved_by = auth.uid(),
      resolution_payload = jsonb_build_object(
        'approved_at', NEW.approved_at,
        'approved_by', NEW.approved_by
      )
    WHERE 
      reference_type = 'document' AND
      reference_id = NEW.id AND
      status = 'pending';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to log pending item resolution as domain event
CREATE OR REPLACE FUNCTION public.log_pending_item_resolution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log domain event when pending item is resolved
  IF OLD.status = 'pending' AND NEW.status IN ('completed', 'cancelled') THEN
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
  
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_create_document_approval_pending ON public.project_documents;
CREATE TRIGGER trigger_create_document_approval_pending
  AFTER INSERT ON public.project_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.create_document_approval_pending_item();

DROP TRIGGER IF EXISTS trigger_resolve_document_approval_pending ON public.project_documents;
CREATE TRIGGER trigger_resolve_document_approval_pending
  AFTER UPDATE ON public.project_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.resolve_document_approval_pending_item();

DROP TRIGGER IF EXISTS trigger_log_pending_item_resolution ON public.pending_items;
CREATE TRIGGER trigger_log_pending_item_resolution
  AFTER UPDATE ON public.pending_items
  FOR EACH ROW
  EXECUTE FUNCTION public.log_pending_item_resolution();