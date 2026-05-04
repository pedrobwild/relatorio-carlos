-- Bloco 1 — Decisão e JTBD: aprovação tácita rastreável
--
-- Contexto: quando um project_documents do tipo 'executive_project' transita
-- para status 'approved' sem actor humano (approved_by IS NULL), inferimos
-- aprovação tácita: o prazo contratual venceu sem manifestação do cliente.
-- Para rastreabilidade jurídica, registramos imediatamente um domain_event
-- imutável com hash do PDF, timestamp e o intervalo silencioso, alimentando a
-- ActivityTimeline e auditorias futuras.
--
-- Observação: a detecção de tácita é feita via INSERT/UPDATE trigger no nível
-- do banco (SECURITY DEFINER) — o front-end não pode garantir registro único
-- e à prova de race conditions; a fonte da verdade tem que ser o DB.

CREATE OR REPLACE FUNCTION public.log_executive_tacit_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_days_silent INTEGER;
  v_payload JSONB;
BEGIN
  -- Só dispara para projeto executivo aprovado tacitamente (sem actor humano)
  IF NEW.document_type <> 'executive_project' THEN
    RETURN NEW;
  END IF;

  -- Detectar transição para 'approved' tácito
  IF NEW.status <> 'approved' OR NEW.approved_at IS NULL OR NEW.approved_by IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Em UPDATE, ignorar quando o status já era 'approved' (idempotência)
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'approved'
     AND OLD.approved_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Achar a org dona do projeto. Em caso de schema legado sem coluna
  -- customer_org_id, caímos para projects.created_by (mesmo critério usado
  -- pelo trigger de pending_items para parcelas).
  BEGIN
    SELECT p.customer_org_id INTO v_org_id
    FROM public.projects p
    WHERE p.id = NEW.project_id;
  EXCEPTION WHEN undefined_column THEN
    SELECT p.created_by INTO v_org_id
    FROM public.projects p
    WHERE p.id = NEW.project_id;
  END;

  IF v_org_id IS NULL THEN
    SELECT p.created_by INTO v_org_id
    FROM public.projects p
    WHERE p.id = NEW.project_id;
  END IF;

  -- Dias silentes = upload (created_at) → tácita (approved_at). Usamos como
  -- proxy do prazo contratual quando o documento não carrega o deadline
  -- explícito. Frontend pode sobrescrever exibindo o valor contratual real.
  v_days_silent := GREATEST(
    0,
    DATE_PART('day', NEW.approved_at - NEW.created_at)::INTEGER
  );

  v_payload := jsonb_build_object(
    'document_id', NEW.id,
    'document_hash', NEW.checksum,
    'deadline_iso', NEW.approved_at,
    'days_silent', v_days_silent,
    'document_version', NEW.version,
    'document_name', NEW.name
  );

  -- Registro imutável; eventos são auditáveis e não permitem update/delete
  -- (RLS de domain_events). Falhas aqui não devem bloquear a aprovação —
  -- engolimos a exceção com aviso para não quebrar o fluxo do staff.
  BEGIN
    PERFORM public.log_domain_event(
      v_org_id,
      NEW.project_id,
      'project_document',
      NEW.id,
      'executive.tacit_approval',
      v_payload,
      NULL,
      'tacit-approval-trigger'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'log_executive_tacit_approval failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_executive_document_tacit_approval ON public.project_documents;

CREATE TRIGGER on_executive_document_tacit_approval
  AFTER INSERT OR UPDATE OF status, approved_at, approved_by
  ON public.project_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.log_executive_tacit_approval();

COMMENT ON FUNCTION public.log_executive_tacit_approval() IS
  'Bloco 1 / Issue #18: registra domain_event executive.tacit_approval quando um project executive é aprovado sem actor humano (approved_by IS NULL).';
