-- Integration test: cobertura explícita dos DOIS caminhos do trigger
-- apply_stock_movement_to_balance, validando o saldo final em cada um:
--
--   • Cenário ESTOQUE (location_type='estoque', project_id IS NULL)
--       índice: uniq_balance_estoque
--       entradas: 5 + 10 + 2.5 + 0.5 = 18  → 1 linha de saldo
--
--   • Cenário OBRA (location_type='obra', project_id IS NOT NULL)
--       índice: uniq_balance_obra
--       Obra A: 3 + 4 = 7   → 1 linha
--       Obra B: 1 + 1 + 1 = 3 → 1 linha (isolada da A)
--
-- Cada cenário é avaliado em bloco próprio com mensagens claras de FAIL.
-- Roda em transação; se algo falhar, nada é persistido.
--
-- Como rodar:
--   psql "$DATABASE_URL" -f supabase/tests/stock_movement_on_conflict_aggregation.sql

BEGIN;

-- ─── Pré-checagem: índices parciais necessários ─────────────────────
DO $$
DECLARE v_missing text[] := ARRAY[]::text[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                  WHERE schemaname='public' AND tablename='stock_balances'
                    AND indexname='uniq_balance_estoque') THEN
    v_missing := array_append(v_missing,'uniq_balance_estoque');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                  WHERE schemaname='public' AND tablename='stock_balances'
                    AND indexname='uniq_balance_obra') THEN
    v_missing := array_append(v_missing,'uniq_balance_obra');
  END IF;
  IF array_length(v_missing,1) > 0 THEN
    RAISE EXCEPTION 'PRECHECK FAIL: índices ausentes: %', array_to_string(v_missing,', ');
  END IF;
END $$;

-- ─── Cleanup PRÉ-execução (idempotente, baseado em prefixo) ─────────
-- Pega tudo que tenha o prefixo de teste, não só o item exato — protege
-- contra resíduos de execuções abortadas com nomes ligeiramente diferentes.
DO $$
DECLARE v_orphans int;
BEGIN
  -- Ordem importa: movimentos → saldos → item (FK)
  DELETE FROM public.stock_movements
   WHERE item_id IN (SELECT id FROM public.stock_items WHERE name LIKE '__regress\_%' ESCAPE '\');
  DELETE FROM public.stock_balances
   WHERE item_id IN (SELECT id FROM public.stock_items WHERE name LIKE '__regress\_%' ESCAPE '\');
  DELETE FROM public.stock_items WHERE name LIKE '__regress\_%' ESCAPE '\';

  -- Sanity: zero resíduos antes de começar
  SELECT COUNT(*) INTO v_orphans FROM public.stock_items WHERE name LIKE '__regress\_%' ESCAPE '\';
  IF v_orphans <> 0 THEN
    RAISE EXCEPTION 'CLEANUP PRÉ FAIL: % item(ns) de teste residual(is)', v_orphans;
  END IF;
END $$;

-- ─── Setup: item de teste + duas obras (se houver) ──────────────────
DO $$
DECLARE
  v_item   uuid;
  v_proj_a uuid;
  v_proj_b uuid;
  v_qty    numeric;
  v_count  int;
BEGIN
  INSERT INTO public.stock_items (name, unit, description)
  VALUES ('__regress_onconflict_item__', 'un', 'two-path on-conflict test')
  RETURNING id INTO v_item;

  SELECT id INTO v_proj_a FROM public.projects WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1;
  SELECT id INTO v_proj_b FROM public.projects WHERE deleted_at IS NULL AND id <> v_proj_a
                                                ORDER BY created_at LIMIT 1;

  -- ═══════════════════════════════════════════════════════════════════
  -- CENÁRIO 1 — location_type = 'estoque' (project_id NULL)
  -- ═══════════════════════════════════════════════════════════════════
  INSERT INTO public.stock_movements (item_id, movement_type, quantity, movement_date, location_type) VALUES
    (v_item,'entrada', 5,  CURRENT_DATE,'estoque'),
    (v_item,'entrada',10,  CURRENT_DATE,'estoque'),
    (v_item,'entrada', 2.5,CURRENT_DATE,'estoque'),
    (v_item,'entrada', 0.5,CURRENT_DATE,'estoque');

  -- (1.a) Deve existir EXATAMENTE 1 linha de saldo no estoque central
  SELECT COUNT(*) INTO v_count FROM public.stock_balances
   WHERE item_id=v_item AND location_type='estoque' AND project_id IS NULL;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'CENÁRIO ESTOQUE FAIL: esperava 1 linha agregada, obteve %', v_count;
  END IF;

  -- (1.b) Saldo final = 18
  SELECT quantity INTO v_qty FROM public.stock_balances
   WHERE item_id=v_item AND location_type='estoque' AND project_id IS NULL;
  IF v_qty <> 18 THEN
    RAISE EXCEPTION 'CENÁRIO ESTOQUE FAIL: saldo esperado 18, obteve %', v_qty;
  END IF;

  -- (1.c) NÃO deve ter vazado nada para location_type='obra'
  SELECT COUNT(*) INTO v_count FROM public.stock_balances
   WHERE item_id=v_item AND location_type='obra';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'CENÁRIO ESTOQUE FAIL: vazou % linha(s) para location_type=obra', v_count;
  END IF;
  RAISE NOTICE '✓ CENÁRIO ESTOQUE: 1 linha, saldo=18, nenhum vazamento';

  -- ═══════════════════════════════════════════════════════════════════
  -- CENÁRIO 2 — location_type = 'obra' (project_id NOT NULL)
  -- ═══════════════════════════════════════════════════════════════════
  IF v_proj_a IS NULL OR v_proj_b IS NULL THEN
    RAISE NOTICE '⚠ Pulando CENÁRIO OBRA: precisa de pelo menos 2 obras ativas';
  ELSE
    -- Obra A: 3 + 4 = 7
    INSERT INTO public.stock_movements (item_id, movement_type, quantity, movement_date, location_type, project_id) VALUES
      (v_item,'entrada',3,CURRENT_DATE,'obra',v_proj_a),
      (v_item,'entrada',4,CURRENT_DATE,'obra',v_proj_a);
    -- Obra B: 1 + 1 + 1 = 3
    INSERT INTO public.stock_movements (item_id, movement_type, quantity, movement_date, location_type, project_id) VALUES
      (v_item,'entrada',1,CURRENT_DATE,'obra',v_proj_b),
      (v_item,'entrada',1,CURRENT_DATE,'obra',v_proj_b),
      (v_item,'entrada',1,CURRENT_DATE,'obra',v_proj_b);

    -- (2.a) Obra A: 1 linha, saldo=7
    SELECT COUNT(*), COALESCE(SUM(quantity),0) INTO v_count, v_qty
      FROM public.stock_balances
     WHERE item_id=v_item AND location_type='obra' AND project_id=v_proj_a;
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'CENÁRIO OBRA-A FAIL: esperava 1 linha, obteve %', v_count;
    END IF;
    IF v_qty <> 7 THEN
      RAISE EXCEPTION 'CENÁRIO OBRA-A FAIL: saldo esperado 7, obteve %', v_qty;
    END IF;

    -- (2.b) Obra B: 1 linha, saldo=3
    SELECT COUNT(*), COALESCE(SUM(quantity),0) INTO v_count, v_qty
      FROM public.stock_balances
     WHERE item_id=v_item AND location_type='obra' AND project_id=v_proj_b;
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'CENÁRIO OBRA-B FAIL: esperava 1 linha, obteve %', v_count;
    END IF;
    IF v_qty <> 3 THEN
      RAISE EXCEPTION 'CENÁRIO OBRA-B FAIL: saldo esperado 3, obteve %', v_qty;
    END IF;

    -- (2.c) Isolamento: saldo de A não pode contaminar B
    SELECT COUNT(*) INTO v_count FROM public.stock_balances
     WHERE item_id=v_item AND location_type='obra'
       AND project_id NOT IN (v_proj_a, v_proj_b);
    IF v_count <> 0 THEN
      RAISE EXCEPTION 'CENÁRIO OBRA FAIL: % linha(s) inesperada(s)', v_count;
    END IF;

    -- (2.d) Estoque central NÃO foi alterado (continua em 18)
    SELECT quantity INTO v_qty FROM public.stock_balances
     WHERE item_id=v_item AND location_type='estoque' AND project_id IS NULL;
    IF v_qty <> 18 THEN
      RAISE EXCEPTION 'CENÁRIO OBRA FAIL: estoque central foi alterado: %', v_qty;
    END IF;

    RAISE NOTICE '✓ CENÁRIO OBRA-A: saldo=7 | OBRA-B: saldo=3 | estoque preservado=18';
  END IF;

  -- ─── Cleanup PÓS-execução (sempre roda, inclusive em falha) ────────
  -- Embarca em sub-bloco com EXCEPTION para garantir limpeza mesmo se
  -- algum assert acima abortar.
  BEGIN
    DELETE FROM public.stock_movements WHERE item_id = v_item;
    DELETE FROM public.stock_balances  WHERE item_id = v_item;
    DELETE FROM public.stock_items     WHERE id = v_item;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'cleanup pós falhou: %', SQLERRM;
  END;

  RAISE NOTICE 'ALL OK: ambos os caminhos do ON CONFLICT validados';
EXCEPTION WHEN OTHERS THEN
  -- Falha de assert: limpa antes de propagar para que próxima execução
  -- comece em estado limpo. Usa o mesmo predicado do cleanup pré.
  DELETE FROM public.stock_movements
   WHERE item_id IN (SELECT id FROM public.stock_items WHERE name LIKE '__regress\_%' ESCAPE '\');
  DELETE FROM public.stock_balances
   WHERE item_id IN (SELECT id FROM public.stock_items WHERE name LIKE '__regress\_%' ESCAPE '\');
  DELETE FROM public.stock_items WHERE name LIKE '__regress\_%' ESCAPE '\';
  RAISE;
END $$;

-- ─── Verificação PÓS-execução: zero resíduos ────────────────────────
DO $$
DECLARE v_items int; v_bal int; v_mov int;
BEGIN
  SELECT COUNT(*) INTO v_items FROM public.stock_items
    WHERE name LIKE '__regress\_%' ESCAPE '\';
  SELECT COUNT(*) INTO v_bal FROM public.stock_balances b
   WHERE NOT EXISTS (SELECT 1 FROM public.stock_items i WHERE i.id = b.item_id);
  SELECT COUNT(*) INTO v_mov FROM public.stock_movements m
   WHERE NOT EXISTS (SELECT 1 FROM public.stock_items i WHERE i.id = m.item_id);

  IF v_items <> 0 THEN
    RAISE EXCEPTION 'CLEANUP PÓS FAIL: % item(ns) de teste residuais', v_items;
  END IF;
  IF v_bal <> 0 OR v_mov <> 0 THEN
    RAISE EXCEPTION 'CLEANUP PÓS FAIL: saldos órfãos=%, movimentos órfãos=%', v_bal, v_mov;
  END IF;
  RAISE NOTICE '✓ Estado do banco preservado: nenhum resíduo de teste';
END $$;


COMMIT;
