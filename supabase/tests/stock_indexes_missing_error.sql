-- Negative-path test: quando os índices parciais necessários para o
-- ON CONFLICT do trigger apply_stock_movement_to_balance estão ausentes,
-- a pré-checagem deve abortar com EXCEPTION e a mensagem deve listar
-- explicitamente os índices faltantes.
--
-- Usa SAVEPOINT + ROLLBACK TO para "fingir" a ausência dos índices em
-- uma sub-transação isolada — nada é alterado no schema real.
--
-- Como rodar:
--   psql "$DATABASE_URL" -f supabase/tests/stock_indexes_missing_error.sql

BEGIN;

-- Função reutilizável que reproduz a pré-checagem do healthcheck.
-- Mantida temporariamente nesta transação (será descartada no ROLLBACK).
CREATE OR REPLACE FUNCTION pg_temp.assert_stock_indexes()
RETURNS void
LANGUAGE plpgsql
AS $$
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
    RAISE EXCEPTION 'REGRESSION FAIL: índices parciais ausentes em stock_balances: %',
      array_to_string(v_missing, ', ');
  END IF;
END $$;

-- ─── Cenário A: ambos os índices presentes → não lança ──────────────
DO $$
BEGIN
  PERFORM pg_temp.assert_stock_indexes();
  RAISE NOTICE 'A) ok: ambos os índices presentes';
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'A FAIL: não deveria ter lançado, mas lançou: %', SQLERRM;
END $$;

-- ─── Cenário B: faltam ambos os índices ─────────────────────────────
SAVEPOINT drop_both;
DROP INDEX public.uniq_balance_estoque;
DROP INDEX public.uniq_balance_obra;

DO $$
DECLARE v_msg text;
BEGIN
  BEGIN
    PERFORM pg_temp.assert_stock_indexes();
    RAISE EXCEPTION 'B FAIL: deveria ter lançado quando ambos os índices faltam';
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;

  IF position('REGRESSION FAIL' IN v_msg) = 0 THEN
    RAISE EXCEPTION 'B FAIL: mensagem sem prefixo "REGRESSION FAIL": %', v_msg;
  END IF;
  IF position('uniq_balance_estoque' IN v_msg) = 0 THEN
    RAISE EXCEPTION 'B FAIL: mensagem não cita uniq_balance_estoque: %', v_msg;
  END IF;
  IF position('uniq_balance_obra' IN v_msg) = 0 THEN
    RAISE EXCEPTION 'B FAIL: mensagem não cita uniq_balance_obra: %', v_msg;
  END IF;
  RAISE NOTICE 'B) ok: erro lista ambos: %', v_msg;
END $$;
ROLLBACK TO SAVEPOINT drop_both;

-- ─── Cenário C: falta apenas uniq_balance_obra ──────────────────────
SAVEPOINT drop_obra;
DROP INDEX public.uniq_balance_obra;

DO $$
DECLARE v_msg text;
BEGIN
  BEGIN
    PERFORM pg_temp.assert_stock_indexes();
    RAISE EXCEPTION 'C FAIL: deveria ter lançado';
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;

  IF position('uniq_balance_obra' IN v_msg) = 0 THEN
    RAISE EXCEPTION 'C FAIL: deveria citar uniq_balance_obra: %', v_msg;
  END IF;
  IF position('uniq_balance_estoque' IN v_msg) <> 0 THEN
    RAISE EXCEPTION 'C FAIL: não deveria citar uniq_balance_estoque: %', v_msg;
  END IF;
  RAISE NOTICE 'C) ok: %', v_msg;
END $$;
ROLLBACK TO SAVEPOINT drop_obra;

-- Confirma que os índices reais continuam intactos após os rollbacks
DO $$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM pg_indexes
   WHERE schemaname='public' AND tablename='stock_balances'
     AND indexname IN ('uniq_balance_estoque','uniq_balance_obra');
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'POST FAIL: índices reais foram afetados (esperava 2, achou %)', v_count;
  END IF;
  RAISE NOTICE 'POST) ok: índices reais preservados';
END $$;

ROLLBACK;  -- garante que NADA escapa desta transação
