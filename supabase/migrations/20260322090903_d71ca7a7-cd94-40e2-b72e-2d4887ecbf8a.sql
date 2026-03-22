
-- Trigger: Notify customer when a new payment is created
CREATE OR REPLACE FUNCTION public.notify_payment_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_project_name TEXT;
  v_amount_fmt TEXT;
BEGIN
  -- Get project name
  SELECT name INTO v_project_name FROM projects WHERE id = NEW.project_id;
  
  -- Format amount
  v_amount_fmt := 'R$ ' || to_char(NEW.amount, 'FM999G999D00');
  
  -- Notify each customer linked to the project
  FOR v_user_id IN 
    SELECT customer_user_id FROM project_customers 
    WHERE project_id = NEW.project_id AND customer_user_id IS NOT NULL
  LOOP
    PERFORM create_notification(
      v_user_id,
      'payment_due',
      'Nova parcela: ' || COALESCE(NEW.description, 'Pagamento'),
      v_amount_fmt || ' — Vencimento: ' || to_char(NEW.due_date, 'DD/MM/YYYY'),
      NEW.project_id,
      '/obra/' || NEW.project_id || '?tab=financeiro'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_payment_created
  AFTER INSERT ON public.project_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_payment_created();

-- Trigger: Notify customer when formalization needs signature
CREATE OR REPLACE FUNCTION public.notify_formalization_pending_signature()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF OLD.status IS DISTINCT FROM 'pending_signatures' AND NEW.status = 'pending_signatures' THEN
    -- Notify each customer party that needs to sign
    FOR v_user_id IN 
      SELECT fp.user_id FROM formalization_parties fp 
      WHERE fp.formalization_id = NEW.id 
        AND fp.must_sign = true 
        AND fp.user_id IS NOT NULL
    LOOP
      PERFORM create_notification(
        v_user_id,
        'formalization_pending',
        'Assinatura pendente: ' || NEW.title,
        NEW.summary,
        NEW.project_id,
        '/obra/' || NEW.project_id || '/formalizacoes/' || NEW.id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_formalization_signature
  AFTER UPDATE ON public.formalizations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_formalization_pending_signature();

-- Trigger: Notify when a pending item is created for the customer
CREATE OR REPLACE FUNCTION public.notify_pending_item_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Notify each customer linked to the project
  FOR v_user_id IN 
    SELECT customer_user_id FROM project_customers 
    WHERE project_id = NEW.project_id AND customer_user_id IS NOT NULL
  LOOP
    PERFORM create_notification(
      v_user_id,
      'pending_item_created',
      NEW.title,
      NEW.description,
      NEW.project_id,
      COALESCE(NEW.action_url, '/obra/' || NEW.project_id || '?tab=pendencias')
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_pending_item_created
  AFTER INSERT ON public.pending_items
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_pending_item_created();

-- Trigger: Notify when a document is uploaded for customer review
CREATE OR REPLACE FUNCTION public.notify_document_uploaded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NEW.status = 'pending' THEN
    FOR v_user_id IN 
      SELECT customer_user_id FROM project_customers 
      WHERE project_id = NEW.project_id AND customer_user_id IS NOT NULL
    LOOP
      PERFORM create_notification(
        v_user_id,
        'document_uploaded',
        'Novo documento: ' || NEW.name,
        'Um documento foi adicionado ao seu projeto e aguarda revisão.',
        NEW.project_id,
        '/obra/' || NEW.project_id || '?tab=documentos'
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_document_uploaded
  AFTER INSERT ON public.project_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_document_uploaded();

-- Trigger: Notify when weekly report becomes available
CREATE OR REPLACE FUNCTION public.notify_weekly_report_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_project_name TEXT;
BEGIN
  -- Only notify on insert or when content is first populated
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.data IS DISTINCT FROM NEW.data AND NEW.data IS NOT NULL) THEN
    SELECT name INTO v_project_name FROM projects WHERE id = NEW.project_id;
    
    FOR v_user_id IN 
      SELECT customer_user_id FROM project_customers 
      WHERE project_id = NEW.project_id AND customer_user_id IS NOT NULL
    LOOP
      PERFORM create_notification(
        v_user_id,
        'report_published',
        'Relatório Semana ' || NEW.week_number || ' disponível',
        'O relatório semanal de ' || COALESCE(v_project_name, 'seu projeto') || ' está pronto.',
        NEW.project_id,
        '/obra/' || NEW.project_id || '?tab=evolucao'
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_weekly_report_published
  AFTER INSERT OR UPDATE ON public.weekly_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_weekly_report_published();

-- Trigger: Notify when journey stage changes status
CREATE OR REPLACE FUNCTION public.notify_stage_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_status_label TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_status_label := CASE NEW.status
      WHEN 'in_progress' THEN 'em andamento'
      WHEN 'completed' THEN 'concluída'
      WHEN 'waiting_action' THEN 'aguardando ação do cliente'
      ELSE NEW.status::text
    END;
    
    FOR v_user_id IN 
      SELECT customer_user_id FROM project_customers 
      WHERE project_id = NEW.project_id AND customer_user_id IS NOT NULL
    LOOP
      PERFORM create_notification(
        v_user_id,
        'stage_changed',
        'Etapa "' || NEW.name || '" ' || v_status_label,
        COALESCE(NEW.description, ''),
        NEW.project_id,
        '/obra/' || NEW.project_id || '/jornada'
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_stage_changed
  AFTER UPDATE ON public.journey_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_stage_changed();
