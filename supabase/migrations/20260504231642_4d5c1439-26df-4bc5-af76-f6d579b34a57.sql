-- Healthcheck RPC: valida que os índices parciais exigidos pelo trigger
-- apply_stock_movement_to_balance estão presentes e compatíveis.
-- Retorna jsonb { ok, missing[], details[] }. Não lança exceção:
-- o cliente decide o que fazer com o resultado.
CREATE OR REPLACE FUNCTION public.check_stock_balance_indexes()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  v_details jsonb  := '[]'::jsonb;
  r record;
  v_expected_estoque text := '(item_id) WHERE ((location_type = ''estoque''::text) AND (project_id IS NULL))';
  v_expected_obra    text := '(item_id, project_id) WHERE ((location_type = ''obra''::text) AND (project_id IS NOT NULL))';
BEGIN
  -- uniq_balance_estoque
  SELECT indexdef INTO r
    FROM pg_indexes
   WHERE schemaname = 'public'
     AND tablename  = 'stock_balances'
     AND indexname  = 'uniq_balance_estoque';

  IF NOT FOUND THEN
    v_missing := array_append(v_missing, 'uniq_balance_estoque');
    v_details := v_details || jsonb_build_object('index', 'uniq_balance_estoque', 'status', 'missing');
  ELSIF position(v_expected_estoque IN r.indexdef) = 0 THEN
    v_missing := array_append(v_missing, 'uniq_balance_estoque');
    v_details := v_details || jsonb_build_object(
      'index', 'uniq_balance_estoque', 'status', 'mismatch',
      'expected_clause', v_expected_estoque, 'actual_def', r.indexdef
    );
  ELSE
    v_details := v_details || jsonb_build_object('index', 'uniq_balance_estoque', 'status', 'ok');
  END IF;

  -- uniq_balance_obra
  SELECT indexdef INTO r
    FROM pg_indexes
   WHERE schemaname = 'public'
     AND tablename  = 'stock_balances'
     AND indexname  = 'uniq_balance_obra';

  IF NOT FOUND THEN
    v_missing := array_append(v_missing, 'uniq_balance_obra');
    v_details := v_details || jsonb_build_object('index', 'uniq_balance_obra', 'status', 'missing');
  ELSIF position(v_expected_obra IN r.indexdef) = 0 THEN
    v_missing := array_append(v_missing, 'uniq_balance_obra');
    v_details := v_details || jsonb_build_object(
      'index', 'uniq_balance_obra', 'status', 'mismatch',
      'expected_clause', v_expected_obra, 'actual_def', r.indexdef
    );
  ELSE
    v_details := v_details || jsonb_build_object('index', 'uniq_balance_obra', 'status', 'ok');
  END IF;

  RETURN jsonb_build_object(
    'ok',      array_length(v_missing, 1) IS NULL,
    'missing', to_jsonb(v_missing),
    'details', v_details,
    'checked_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_stock_balance_indexes() TO authenticated, anon;