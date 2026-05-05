-- Regression test: assistant_truncation_stats RPC
--
-- Garante que `public.assistant_truncation_stats(hours_back)`:
--   1) calcula corretamente total_responses, truncated_count, truncation_rate
--      (em %, com 2 casas) e avg_answer_length (arredondado para inteiro);
--   2) reflete os campos preenchidos por streams incompletos (truncated=true
--      com truncation_reason em {finish_reason=length, answer_too_short,
--      unclosed_code_fence, no_terminal_punctuation});
--   3) retorna recent_truncated_at = max(created_at) entre os truncados;
--   4) respeita a janela `hours_back` (linhas mais antigas são ignoradas).
--
-- Roda dentro de BEGIN/ROLLBACK: nenhuma linha é persistida.
-- Como rodar:
--   psql "$DATABASE_URL" -f supabase/tests/assistant_truncation_stats_regression.sql

BEGIN;

-- Marcador único para isolar nossas linhas (não filtramos por user_id porque
-- a RPC agrega tudo na janela; usamos um user_id sintético + DELETE no final).
-- A RPC NÃO filtra por user — então criamos um schema temporário "limpo"
-- usando uma janela curta (1h) e datas controladas via NOW() - intervalos.

-- Pré-condições: a coluna e a função devem existir.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'assistant_truncation_stats'
  ) THEN
    RAISE EXCEPTION 'Função public.assistant_truncation_stats não existe — rode a migration 20260505010717 primeiro.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='assistant_logs'
      AND column_name IN ('answer_length','finish_reason','truncated','truncation_reason')
    GROUP BY table_name HAVING COUNT(*) = 4
  ) THEN
    RAISE EXCEPTION 'assistant_logs não tem todas as colunas de telemetria de truncamento.';
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────
-- Setup: limpa quaisquer linhas pré-existentes na janela de 1h para
-- que o cálculo da RPC seja determinístico durante o teste.
-- (Estamos em transação — será revertido no ROLLBACK final.)
-- ─────────────────────────────────────────────────────────────────────
DELETE FROM public.assistant_logs
 WHERE created_at >= NOW() - INTERVAL '1 hour';

-- IDs sintéticos para os logs do teste (gen_random_uuid garante unicidade).
-- Inserimos 5 linhas dentro da janela de 1h:
--   - 3 truncadas (cada uma com uma razão diferente) + 1 com finish=length
--   - 2 não truncadas (sucesso normal)
-- E 1 linha FORA da janela (created_at = NOW() - 3h) para validar o filtro.

INSERT INTO public.assistant_logs
  (user_id, question, status, answer_length, finish_reason, truncated, truncation_reason, created_at)
VALUES
  -- truncadas (4)
  (gen_random_uuid(), 'q1', 'success', 200,  'length', true,  'finish_reason=length',     NOW() - INTERVAL '5 minutes'),
  (gen_random_uuid(), 'q2', 'success',  20,  'stop',   true,  'answer_too_short',         NOW() - INTERVAL '10 minutes'),
  (gen_random_uuid(), 'q3', 'success', 150,  NULL,     true,  'unclosed_code_fence',      NOW() - INTERVAL '15 minutes'),
  (gen_random_uuid(), 'q4', 'success', 180,  NULL,     true,  'no_terminal_punctuation',  NOW() - INTERVAL '20 minutes'),
  -- não truncadas (2)
  (gen_random_uuid(), 'q5', 'success', 300,  'stop',   false, NULL,                        NOW() - INTERVAL '25 minutes'),
  (gen_random_uuid(), 'q6', 'success', 100,  'stop',   false, NULL,                        NOW() - INTERVAL '30 minutes'),
  -- fora da janela de 1h (deve ser ignorada pela RPC com hours_back=1)
  (gen_random_uuid(), 'q7', 'success', 999,  'length', true,  'finish_reason=length',     NOW() - INTERVAL '3 hours');

-- ─────────────────────────────────────────────────────────────────────
-- Asserts via SELECT INTO ... ; PERFORM ; RAISE EXCEPTION on mismatch.
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r              record;
  expected_avg   numeric := ROUND(((200+20+150+180+300+100)::numeric / 6), 0); -- = 158
  expected_max   timestamptz;
BEGIN
  -- O timestamp esperado de recent_truncated_at é o mais recente entre os 4 truncados na janela.
  SELECT MAX(created_at) INTO expected_max
    FROM public.assistant_logs
   WHERE truncated = true
     AND created_at >= NOW() - INTERVAL '1 hour';

  -- Chama a RPC com janela de 1h.
  SELECT * INTO r FROM public.assistant_truncation_stats(1);

  IF r.total_responses <> 6 THEN
    RAISE EXCEPTION 'total_responses esperado=6, obtido=%', r.total_responses;
  END IF;

  IF r.truncated_count <> 4 THEN
    RAISE EXCEPTION 'truncated_count esperado=4, obtido=%', r.truncated_count;
  END IF;

  -- 4/6 = 66.67%
  IF r.truncation_rate <> 66.67 THEN
    RAISE EXCEPTION 'truncation_rate esperado=66.67, obtido=%', r.truncation_rate;
  END IF;

  -- AVG(answer_length) sobre as 6 linhas dentro da janela (linha de 3h fora ignorada)
  IF r.avg_answer_length <> expected_avg THEN
    RAISE EXCEPTION 'avg_answer_length esperado=%, obtido=%', expected_avg, r.avg_answer_length;
  END IF;

  IF r.recent_truncated_at IS DISTINCT FROM expected_max THEN
    RAISE EXCEPTION 'recent_truncated_at esperado=%, obtido=%', expected_max, r.recent_truncated_at;
  END IF;

  RAISE NOTICE 'OK: assistant_truncation_stats(1) = total=%, trunc=%, rate=%%, avg=%, recent=%',
    r.total_responses, r.truncated_count, r.truncation_rate, r.avg_answer_length, r.recent_truncated_at;
END$$;

-- ─────────────────────────────────────────────────────────────────────
-- Caso 2: janela ZERO (hours_back=0) deve retornar tudo zerado mesmo
-- com linhas existentes (o filtro vira created_at >= NOW()).
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.assistant_truncation_stats(0);
  IF r.total_responses <> 0 THEN
    RAISE EXCEPTION 'janela 0h: total_responses esperado=0, obtido=%', r.total_responses;
  END IF;
  IF r.truncation_rate <> 0 THEN
    RAISE EXCEPTION 'janela 0h: truncation_rate esperado=0, obtido=%', r.truncation_rate;
  END IF;
  IF r.recent_truncated_at IS NOT NULL THEN
    RAISE EXCEPTION 'janela 0h: recent_truncated_at esperado=NULL, obtido=%', r.recent_truncated_at;
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────
-- Caso 3: janela ampla (24h) inclui também a linha fora da 1h.
-- 7 linhas total, 5 truncadas (incluindo a de 3h atrás).
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.assistant_truncation_stats(24);
  IF r.total_responses <> 7 THEN
    RAISE EXCEPTION '24h: total_responses esperado=7, obtido=%', r.total_responses;
  END IF;
  IF r.truncated_count <> 5 THEN
    RAISE EXCEPTION '24h: truncated_count esperado=5, obtido=%', r.truncated_count;
  END IF;
  -- 5/7 = 71.43%
  IF r.truncation_rate <> 71.43 THEN
    RAISE EXCEPTION '24h: truncation_rate esperado=71.43, obtido=%', r.truncation_rate;
  END IF;
END$$;

ROLLBACK;

\echo '✓ assistant_truncation_stats regression: OK'
