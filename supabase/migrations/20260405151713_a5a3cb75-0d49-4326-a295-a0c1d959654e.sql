-- Replace the trigger function with hardcoded project URL (it's the same project calling itself)
CREATE OR REPLACE FUNCTION public.sync_supplier_to_envision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_request_id bigint;
  v_payload jsonb;
  v_project_url text := 'https://fvblcyzdcqkiihyhfrrw.supabase.co';
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2YmxjeXpkY3FraWloeWhmcnJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTc3MzUsImV4cCI6MjA4MTMzMzczNX0.zrSOoXrdBh4QZLTbyprpuhXFalbWl9kHaRzBJjcEMIk';
BEGIN
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
  -- Uses anon key; the edge function validates internally
  PERFORM net.http_post(
    url := v_project_url || '/functions/v1/sync-suppliers-outbound',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body := v_payload
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the original INSERT/UPDATE if sync fails
  RAISE WARNING '[sync_supplier_to_envision] Failed for supplier %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;