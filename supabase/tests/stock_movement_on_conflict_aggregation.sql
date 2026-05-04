-- Integration test: ON CONFLICT aggregation em stock_balances
--
-- Garante que múltiplas entradas para o mesmo (item, location_type, project_id)
-- são acumuladas em UMA ÚNICA linha de saldo via ON CONFLICT DO UPDATE,
-- e que combinações distintas (estoque vs obras diferentes) ficam isoladas.
--
-- Como rodar:
--   psql "$DATABASE_URL" -f supabase/tests/stock_movement_on_conflict_aggregation.sql

BEGIN;

-- Pré-checagem: índices parciais exigidos pelo trigger
DO $$
DECLARE v_missing text[] := ARRAY[]::text[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                  WHERE schemaname='public' AND tablename='stock_balances'
                    AND indexname='uniq_balance_estoque') THEN
    v_missing := array_append(v_missing, 'uniq_balance_estoque');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                  WHERE schemaname='public' AND tablename='stock_balances'
                    AND indexname='uniq_balance_obra') THEN
    v_missing := array_append(v_missing, 'uniq_balance_obra');
  END IF;
  IF array_length(v_missing,1) > 0 THEN
    RAISE EXCEPTION 'PRECHECK FAIL: índices ausentes: %', array_to_string(v_missing,', ');
  END IF;
END $$;

-- Cleanup de execuções anteriores
DELETE FROM public.stock_movements
 WHERE item_id IN (SELECT id FROM public.stock_items WHERE name = '__regress_onconflict_item__');
DELETE FROM public.stock_balances
 WHERE item_id IN (SELECT id FROM public.stock_items WHERE name = '__regress_onconflict_item__');
DELETE FROM public.stock_items WHERE name = '__regress_onconflict_item__';

DO $$
DECLARE
  v_item       uuid;
  v_proj_a     uuid;
  v_proj_b     uuid;
  v_qty        numeric;
  v_count      int;
BEGIN
  -- Item de teste
  INSERT INTO public.stock_items (name, unit, description)
  VALUES ('__regress_onconflict_item__', 'un', 'on-conflict aggregation test')
  RETURNING id INTO v_item;

  -- Duas obras distintas (se existirem)
  SELECT id INTO v_proj_a FROM public.projects WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1;
  SELECT id INTO v_proj_b FROM public.projects WHERE deleted_at IS NULL AND id <> v_proj_a
                                                ORDER BY created_at LIMIT 1;

  -- ─── Cenário 1: 4 entradas no estoque central ───────────────────────
  -- 5 + 10 + 2.5 + 0.5 = 18, em UMA única linha de stock_balances
  INSERT INTO public.stock_movements (item_id, movement_type, quantity, movement_date, location_type)
  VALUES
    (v_item, 'entrada',  5,   CURRENT_DATE, 'estoque'),
    (v_item, 'entrada', 10,   CURRENT_DATE, 'estoque'),
    (v_item, 'entrada',  2.5, CURRENT_DATE, 'estoque'),
    (v_item, 'entrada',  0.5, CURRENT_DATE, 'estoque');

  SELECT COUNT(*), COALESCE(SUM(quantity),0)
    INTO v_count, v_qty
    FROM public.stock_balances
   WHERE item_id = v_item AND location_type = 'estoque' AND project_id IS NULL;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL estoque: esperava 1 linha agregada, obteve %', v_count;
  END IF;
  IF v_qty <> 18 THEN
    RAISE EXCEPTION 'FAIL estoque: saldo esperado 18, obteve %', v_qty;
  END IF;

  -- ─── Cenário 2: entradas em duas obras distintas ────────────────────
  IF v_proj_a IS NOT NULL AND v_proj_b IS NOT NULL THEN
    -- Obra A: 3 + 4 = 7
    INSERT INTO public.stock_movements (item_id, movement_type, quantity, movement_date, location_type, project_id)
    VALUES
      (v_item, 'entrada', 3, CURRENT_DATE, 'obra', v_proj_a),
      (v_item, 'entrada', 4, CURRENT_DATE, 'obra', v_proj_a);
    -- Obra B: 1 + 1 + 1 = 3
    INSERT INTO public.stock_movements (item_id, movement_type, quantity, movement_date, location_type, project_id)
    VALUES
      (v_item, 'entrada', 1, CURRENT_DATE, 'obra', v_proj_b),
      (v_item, 'entrada', 1, CURRENT_DATE, 'obra', v_proj_b),
      (v_item, 'entrada', 1, CURRENT_DATE, 'obra', v_proj_b);

    -- Cada obra tem exatamente 1 linha; saldos isolados
    SELECT COUNT(*), COALESCE(SUM(quantity),0) INTO v_count, v_qty
      FROM public.stock_balances
     WHERE item_id=v_item AND location_type='obra' AND project_id=v_proj_a;
    IF v_count <> 1 OR v_qty <> 7 THEN
      RAISE EXCEPTION 'FAIL obra A: esperava 1 linha com 7, obteve % linha(s) com %', v_count, v_qty;
    END IF;

    SELECT COUNT(*), COALESCE(SUM(quantity),0) INTO v_count, v_qty
      FROM public.stock_balances
     WHERE item_id=v_item AND location_type='obra' AND project_id=v_proj_b;
    IF v_count <> 1 OR v_qty <> 3 THEN
      RAISE EXCEPTION 'FAIL obra B: esperava 1 linha com 3, obteve % linha(s) com %', v_count, v_qty;
    END IF;

    -- Total geral do item: 18 (estoque) + 7 (A) + 3 (B) = 28, em 3 linhas
    SELECT COUNT(*), COALESCE(SUM(quantity),0) INTO v_count, v_qty
      FROM public.stock_balances WHERE item_id=v_item;
    IF v_count <> 3 OR v_qty <> 28 THEN
      RAISE EXCEPTION 'FAIL agregação total: esperava 3 linhas/28, obteve %/% ', v_count, v_qty;
    END IF;
  ELSE
    RAISE NOTICE 'Pulando cenário 2: precisa de pelo menos 2 obras ativas';
  END IF;

  -- Cleanup
  DELETE FROM public.stock_movements WHERE item_id = v_item;
  DELETE FROM public.stock_balances  WHERE item_id = v_item;
  DELETE FROM public.stock_items     WHERE id = v_item;

  RAISE NOTICE 'OK: ON CONFLICT agrega corretamente entradas duplicadas';
END $$;

COMMIT;
