-- Enable pg_net for async HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to trigger supplier sync via edge function
CREATE OR REPLACE FUNCTION public.sync_supplier_to_envision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_supabase_url text;
  v_service_key text;
  v_request_id bigint;
  v_payload jsonb;
BEGIN
  -- Get config from vault/env (these are available in pg functions)
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_key := current_setting('app.settings.service_role_key', true);

  -- Fallback: try direct env vars
  IF v_supabase_url IS NULL THEN
    v_supabase_url := current_setting('supabase.url', true);
  END IF;
  IF v_service_key IS NULL THEN
    v_service_key := current_setting('supabase.service_role_key', true);
  END IF;

  -- If we still can't get config, log and skip
  IF v_supabase_url IS NULL OR v_service_key IS NULL THEN
    RAISE WARNING '[sync_supplier_to_envision] Missing supabase config, skipping sync for supplier %', NEW.id;
    RETURN NEW;
  END IF;

  -- Build payload with supplier data to avoid extra DB fetch in edge function
  v_payload := jsonb_build_object(
    'supplier_id', NEW.id,
    'supplier_data', jsonb_build_object(
      'nome', NEW.nome,
      'razao_social', NEW.razao_social,
      'cnpj_cpf', NEW.cnpj_cpf,
      'categoria', NEW.categoria,
      'endereco', NEW.endereco,
      'cidade', NEW.cidade,
      'estado', NEW.estado,
      'email', NEW.email,
      'telefone', NEW.telefone,
      'site', NEW.site,
      'condicoes_pagamento', NEW.condicoes_pagamento,
      'prazo_entrega_dias', NEW.prazo_entrega_dias,
      'produtos_servicos', NEW.produtos_servicos,
      'nota_avaliacao', NEW.nota_avaliacao,
      'status', NEW.status
    )
  );

  -- Async HTTP POST to edge function via pg_net
  SELECT net.http_post(
    url := v_supabase_url || '/functions/v1/sync-suppliers-outbound',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := v_payload
  ) INTO v_request_id;

  RAISE LOG '[sync_supplier_to_envision] Triggered sync for supplier % (request: %)', NEW.id, v_request_id;

  RETURN NEW;
END;
$$;

-- Trigger on INSERT and UPDATE (skip if only updated_at changed)
CREATE TRIGGER trg_sync_supplier_to_envision
  AFTER INSERT OR UPDATE OF nome, razao_social, cnpj_cpf, categoria, supplier_type, supplier_subcategory,
    endereco, cidade, estado, cep, email, telefone, site, condicoes_pagamento,
    prazo_entrega_dias, produtos_servicos, nota_avaliacao, status, observacoes
  ON public.fornecedores
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_supplier_to_envision();