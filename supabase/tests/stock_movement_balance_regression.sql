-- Regression test: registrar entrada no estoque
--
-- Garante que o trigger `apply_stock_movement_to_balance` consegue
-- inserir/atualizar `stock_balances` sem falhar com:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--
-- Cobre os dois caminhos do trigger:
--   1) location_type = 'estoque' (project_id NULL) → índice uniq_balance_estoque
--   2) location_type = 'obra'    (project_id NOT NULL) → índice uniq_balance_obra
--
-- Roda em transação: se qualquer assert falhar, a execução aborta com EXCEPTION
-- e nada é persistido. Em caso de sucesso, faz cleanup explícito ao final.
--
-- Como rodar manualmente:
--   psql "$DATABASE_URL" -f supabase/tests/stock_movement_balance_regression.sql

BEGIN;

-- Limpa qualquer resíduo de execuções anteriores
DELETE FROM public.stock_movements
 WHERE item_id IN (SELECT id FROM public.stock_items WHERE name = '__regress_stock_item__');
DELETE FROM public.stock_balances
 WHERE item_id IN (SELECT id FROM public.stock_items WHERE name = '__regress_stock_item__');
DELETE FROM public.stock_items WHERE name = '__regress_stock_item__';

DO $$
DECLARE
  v_item uuid;
  v_proj uuid;
  v_qty_estoque numeric;
  v_qty_obra numeric;
  v_count_estoque int;
  v_count_obra int;
BEGIN
  -- Item de teste
  INSERT INTO public.stock_items (name, unit, description)
  VALUES ('__regress_stock_item__', 'un', 'regression test')
  RETURNING id INTO v_item;

  -- Obra existente (opcional)
  SELECT id INTO v_proj FROM public.projects WHERE deleted_at IS NULL LIMIT 1;

  -- ─── Caminho 1: estoque central ──────────────────────────────────────
  INSERT INTO public.stock_movements
    (item_id, movement_type, quantity, movement_date, location_type)
  VALUES (v_item, 'entrada', 10, CURRENT_DATE, 'estoque');

  -- segunda entrada exercita o ramo ON CONFLICT DO UPDATE
  INSERT INTO public.stock_movements
    (item_id, movement_type, quantity, movement_date, location_type)
  VALUES (v_item, 'entrada', 5, CURRENT_DATE, 'estoque');

  SELECT quantity INTO v_qty_estoque
    FROM public.stock_balances
   WHERE item_id = v_item AND location_type = 'estoque' AND project_id IS NULL;
  SELECT COUNT(*) INTO v_count_estoque
    FROM public.stock_balances
   WHERE item_id = v_item AND location_type = 'estoque' AND project_id IS NULL;

  IF v_count_estoque <> 1 THEN
    RAISE EXCEPTION 'REGRESSION FAIL: esperava 1 linha em stock_balances (estoque), obteve %', v_count_estoque;
  END IF;
  IF v_qty_estoque <> 15 THEN
    RAISE EXCEPTION 'REGRESSION FAIL: saldo estoque esperado 15, obteve %', v_qty_estoque;
  END IF;

  -- ─── Caminho 2: obra ────────────────────────────────────────────────
  IF v_proj IS NOT NULL THEN
    INSERT INTO public.stock_movements
      (item_id, movement_type, quantity, movement_date, location_type, project_id)
    VALUES (v_item, 'entrada', 7, CURRENT_DATE, 'obra', v_proj);

    INSERT INTO public.stock_movements
      (item_id, movement_type, quantity, movement_date, location_type, project_id)
    VALUES (v_item, 'entrada', 3, CURRENT_DATE, 'obra', v_proj);

    SELECT quantity INTO v_qty_obra
      FROM public.stock_balances
     WHERE item_id = v_item AND location_type = 'obra' AND project_id = v_proj;
    SELECT COUNT(*) INTO v_count_obra
      FROM public.stock_balances
     WHERE item_id = v_item AND location_type = 'obra' AND project_id = v_proj;

    IF v_count_obra <> 1 THEN
      RAISE EXCEPTION 'REGRESSION FAIL: esperava 1 linha em stock_balances (obra), obteve %', v_count_obra;
    END IF;
    IF v_qty_obra <> 10 THEN
      RAISE EXCEPTION 'REGRESSION FAIL: saldo obra esperado 10, obteve %', v_qty_obra;
    END IF;
  ELSE
    RAISE NOTICE 'Sem obras ativas: caminho location_type=obra não foi exercitado';
  END IF;

  -- Cleanup (ordem importa por causa da FK)
  DELETE FROM public.stock_movements WHERE item_id = v_item;
  DELETE FROM public.stock_balances  WHERE item_id = v_item;
  DELETE FROM public.stock_items     WHERE id = v_item;

  RAISE NOTICE 'REGRESSION OK: estoque=%, obra=%', v_qty_estoque, COALESCE(v_qty_obra, 0);
END $$;

COMMIT;
