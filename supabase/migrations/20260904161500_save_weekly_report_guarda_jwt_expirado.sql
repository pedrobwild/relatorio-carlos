-- save_weekly_report: guarda contra JWT vencido + telemetria de iat/exp.
--
-- O QUE FOI VISTO (04/09/2026, 16:15 UTC)
-- Depois da migração 20260904150000 o laço de conflito caiu de centenas de
-- chamadas/s para ~5/s, mas NÃO morreu quando a sessão do usuário foi
-- invalidada. A telemetria por sequences mostrou o motivo: as chamadas
-- chegavam com um JWT cujo `exp` era 2026-08-31 12:33 — vencido havia QUATRO
-- DIAS — e o PostgREST as deixava passar (`auth.uid()` resolvia normalmente).
-- Um token em uso contínuo, ao que tudo indica, sobrevive no cache de JWT do
-- PostgREST além do próprio `exp`. Como o cliente nunca precisa renovar, nada
-- que se faça em `auth.sessions` alcança a aba.
--
-- O QUE MUDA
--  * Guarda de `exp` no TOPO da função, antes de qualquer consulta: token
--    vencido é recusado com 42501 "JWT expired" em microssegundos, sem tocar
--    o pool. Para um cliente legítimo com token vencido, a mensagem casa com
--    o classificador de sessão expirada do app (renova e segue).
--  * Sequences `..._jwt_iat` / `..._jwt_exp` e `weekly_report_conflict_status()`
--    passa a expor o iat/exp do último conflito.
--
-- A guarda é local a esta RPC de propósito: é onde o problema apareceu e onde
-- ele tem custo. Um tratamento geral pertence ao PostgREST (versão/cache), não
-- a cada função nossa.
--
-- Aplicada em produção em 04/09/2026 às 16:17 UTC.

CREATE SEQUENCE IF NOT EXISTS public.save_weekly_report_conflict_jwt_exp MINVALUE 0 START 0;
CREATE SEQUENCE IF NOT EXISTS public.save_weekly_report_conflict_jwt_iat MINVALUE 0 START 0;
REVOKE ALL ON SEQUENCE
  public.save_weekly_report_conflict_jwt_exp,
  public.save_weekly_report_conflict_jwt_iat
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_weekly_report(p_project_id uuid, p_week_number integer, p_week_start date, p_week_end date, p_data jsonb, p_expected_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS weekly_reports
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET lock_timeout TO '250ms'
AS $function$
DECLARE
  existing public.weekly_reports;
  result public.weekly_reports;
  claims jsonb;
  jwt_exp bigint;
BEGIN
  -- Guarda contra token VENCIDO. Não deveria ser necessária — o PostgREST
  -- rejeita JWT expirado antes de chegar aqui —, mas em 04/09 um laço rodou
  -- por 4 dias com um token cujo `exp` era de 31/08 12:33 (cache de JWT do
  -- PostgREST). Sem isto, invalidar a sessão do usuário não encerra o laço,
  -- porque ele nunca precisa renovar o token. Vem ANTES de qualquer consulta:
  -- a recusa custa microssegundos e não segura conexão do pool.
  BEGIN
    claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
    jwt_exp := floor((claims->>'exp')::numeric)::bigint;
  EXCEPTION WHEN OTHERS THEN
    claims := NULL;
    jwt_exp := NULL;
  END;
  IF jwt_exp IS NOT NULL AND jwt_exp < extract(epoch from now()) THEN
    RAISE EXCEPTION 'JWT expired' USING ERRCODE = '42501';
  END IF;

  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para salvar relatórios' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_project_access(auth.uid(), p_project_id) THEN
    RAISE EXCEPTION 'Sem acesso a este projeto' USING ERRCODE = '42501';
  END IF;

  -- Pré-checagem de versão SEM lock. Um cliente com versão velha é recusado
  -- aqui, antes de disputar a linha — assim ele nunca enfileira atrás de
  -- ninguém nem segura conexão do pool esperando lock.
  IF p_expected_updated_at IS NOT NULL THEN
    SELECT * INTO existing
    FROM public.weekly_reports
    WHERE project_id = p_project_id AND week_number = p_week_number;

    IF existing.id IS NOT NULL
       AND date_trunc('milliseconds', existing.updated_at) <> date_trunc('milliseconds', p_expected_updated_at) THEN
      -- Telemetria via SEQUENCES: é a única coisa que sobrevive ao ROLLBACK
      -- que o RAISE abaixo provoca (um INSERT seria desfeito junto).
      BEGIN
        PERFORM nextval('public.save_weekly_report_conflict_seq');
        PERFORM setval('public.save_weekly_report_conflict_expected_ms', GREATEST(0, floor(extract(epoch from p_expected_updated_at) * 1000))::bigint, true);
        PERFORM setval('public.save_weekly_report_conflict_actual_ms', GREATEST(0, floor(extract(epoch from existing.updated_at) * 1000))::bigint, true);
        PERFORM setval('public.save_weekly_report_conflict_uid', ('x' || left(replace(auth.uid()::text, '-', ''), 15))::bit(60)::bigint, true);
        PERFORM setval('public.save_weekly_report_conflict_jwt_exp', COALESCE(jwt_exp, 0), true);
        PERFORM setval('public.save_weekly_report_conflict_jwt_iat', COALESCE(floor((claims->>'iat')::numeric)::bigint, 0), true);
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
      -- Freio: um cliente que insiste no MESMO conflito em laço (foi o que
      -- derrubou o portal em 29-30/08 e 04/09, a ~340 chamadas/s) passa a
      -- render no máximo 1 chamada/s por laço. Para uma pessoa é 1s a mais
      -- antes do aviso; para o laço é o fim da avalanche.
      PERFORM pg_sleep(1.0);
      RAISE EXCEPTION 'WEEKLY_REPORT_CONFLICT' USING ERRCODE = '40001';
    END IF;
  END IF;

  -- NOWAIT: se a linha está tomada, devolve 55P03 na hora em vez de segurar
  -- a conexão até o lock_timeout.
  SELECT * INTO existing
  FROM public.weekly_reports
  WHERE project_id = p_project_id AND week_number = p_week_number
  FOR UPDATE NOWAIT;

  IF existing.id IS NULL THEN
    INSERT INTO public.weekly_reports (project_id, week_number, week_start, week_end, data)
    VALUES (p_project_id, p_week_number, p_week_start, p_week_end, p_data)
    RETURNING * INTO result;
    RETURN result;
  END IF;

  -- Rechecagem sob lock: fecha a janela entre a pré-checagem e o UPDATE.
  IF p_expected_updated_at IS NOT NULL
     AND date_trunc('milliseconds', existing.updated_at) <> date_trunc('milliseconds', p_expected_updated_at) THEN
    RAISE EXCEPTION 'WEEKLY_REPORT_CONFLICT' USING ERRCODE = '40001';
  END IF;

  UPDATE public.weekly_reports
  SET week_start = p_week_start,
      week_end = p_week_end,
      data = p_data
  WHERE id = existing.id
  RETURNING * INTO result;

  RETURN result;
END;
$function$;

-- Tipo de retorno muda (duas colunas novas): precisa de DROP antes.
DROP FUNCTION IF EXISTS public.weekly_report_conflict_status();
CREATE FUNCTION public.weekly_report_conflict_status()
RETURNS TABLE (conflicts bigint, last_expected timestamptz, last_actual timestamptz, last_user_email text, last_jwt_iat timestamptz, last_jwt_exp timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    (SELECT last_value FROM public.save_weekly_report_conflict_seq),
    to_timestamp((SELECT last_value FROM public.save_weekly_report_conflict_expected_ms) / 1000.0),
    to_timestamp((SELECT last_value FROM public.save_weekly_report_conflict_actual_ms) / 1000.0),
    (SELECT u.email::text FROM auth.users u
      WHERE ('x' || left(replace(u.id::text, '-', ''), 15))::bit(60)::bigint
            = (SELECT last_value FROM public.save_weekly_report_conflict_uid)),
    to_timestamp((SELECT last_value FROM public.save_weekly_report_conflict_jwt_iat)),
    to_timestamp((SELECT last_value FROM public.save_weekly_report_conflict_jwt_exp));
$function$;

REVOKE ALL ON FUNCTION public.weekly_report_conflict_status() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.weekly_report_conflict_status() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.weekly_report_conflict_status() TO service_role;
