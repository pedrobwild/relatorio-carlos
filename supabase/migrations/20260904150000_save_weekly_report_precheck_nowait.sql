-- save_weekly_report: pré-checagem sem lock, NOWAIT, telemetria e freio.
--
-- O QUE ACONTECEU (04/09/2026)
-- Uma aba do portal aberta há dias — com um bundle anterior ao fix #104 —
-- entrou em laço chamando esta RPC com o MESMO `p_expected_updated_at`
-- (carimbo do relógio do cliente, 7s à frente do `updated_at` real), a
-- centenas de chamadas por segundo. Cada chamada:
--   1. abria transação e tomava `FOR UPDATE` na linha;
--   2. só então comparava a versão e levantava WEEKLY_REPORT_CONFLICT.
-- Com várias em paralelo, elas enfileiravam umas atrás das outras no lock,
-- cada uma segurando uma conexão do pool do PostgREST até o `lock_timeout`.
-- O pool (11 conexões) esgotou e TODA requisição REST passou a responder
-- 503 — inclusive a leitura de `user_roles`, o que prendeu outros usuários
-- no esqueleto de carregamento ("Estamos com instabilidade no servidor").
--
-- O QUE MUDA
--  * Pré-checagem de versão ANTES do lock: cliente com versão velha é
--    recusado sem disputar a linha.
--  * `FOR UPDATE NOWAIT`: se a linha está tomada, 55P03 na hora, sem segurar
--    conexão esperando.
--  * Telemetria por SEQUENCES: o RAISE desfaz a transação inteira, então um
--    INSERT de log seria desfeito junto. Sequências são não-transacionais —
--    a única coisa que sobrevive ao rollback. `weekly_report_conflict_status()`
--    lê: quantos conflitos, o último carimbo esperado x real e quem foi.
--  * Freio de 1s no caminho do conflito: quem insiste em laço no mesmo
--    conflito rende no máximo 1 chamada/s por laço. Para uma pessoa é 1s a
--    mais antes do aviso de conflito.
--
-- Aplicada em produção em 04/09/2026 durante o incidente.

CREATE SEQUENCE IF NOT EXISTS public.save_weekly_report_conflict_seq MINVALUE 0 START 0;
CREATE SEQUENCE IF NOT EXISTS public.save_weekly_report_conflict_expected_ms MINVALUE 0 START 0;
CREATE SEQUENCE IF NOT EXISTS public.save_weekly_report_conflict_actual_ms MINVALUE 0 START 0;
CREATE SEQUENCE IF NOT EXISTS public.save_weekly_report_conflict_uid MINVALUE 0 START 0;

REVOKE ALL ON SEQUENCE
  public.save_weekly_report_conflict_seq,
  public.save_weekly_report_conflict_expected_ms,
  public.save_weekly_report_conflict_actual_ms,
  public.save_weekly_report_conflict_uid
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
BEGIN
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

-- Leitura da telemetria. Só service_role (SQL editor / operação): expõe
-- e-mail de usuário.
CREATE OR REPLACE FUNCTION public.weekly_report_conflict_status()
RETURNS TABLE (conflicts bigint, last_expected timestamptz, last_actual timestamptz, last_user_email text)
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
            = (SELECT last_value FROM public.save_weekly_report_conflict_uid));
$function$;

REVOKE ALL ON FUNCTION public.weekly_report_conflict_status() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.weekly_report_conflict_status() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.weekly_report_conflict_status() TO service_role;
