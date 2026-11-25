-- Avisos que o time esperava e não chegavam:
--
-- 1. Alertas de Cronograma só existiam na tela (/gestao/alertas-cronograma):
--    nada era gravado em notifications. Agora, todo dia útil de manhã, quem
--    responde pela obra recebe UM aviso no sino resumindo as atividades com
--    início/término previsto vencido e sem data real. Destinatário: o gestor
--    da obra (painel_responsavel_id); sem gestor, o engenheiro principal.
--
-- 2. O resumo diário por e-mail (send-notification-digest) nunca foi
--    agendado. Passa a rodar todo dia às 08h (Brasília), logo após o item 1,
--    enviando as notificações não lidas das últimas 24h.

CREATE OR REPLACE FUNCTION public.notify_schedule_alerts_daily()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_day_start timestamptz := v_today::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_url constant text := '/gestao/alertas-cronograma';
  v_count integer := 0;
  r record;
BEGIN
  FOR r IN
    WITH pend AS (
      -- Mesma regra da tela (useScheduleAlerts): janela de 180 dias,
      -- início ou término previsto já passou e a data real está vazia.
      SELECT a.project_id, count(*) AS n
        FROM public.project_activities a
        JOIN public.projects p ON p.id = a.project_id
       WHERE p.deleted_at IS NULL
         AND p.actual_end_date IS NULL
         AND a.planned_start >= v_today - 180
         AND (
           (a.actual_start IS NULL AND a.planned_start <= v_today)
           OR (a.actual_end IS NULL AND a.planned_end <= v_today)
         )
       GROUP BY a.project_id
    ),
    dest AS (
      SELECT pend.project_id, pend.n, p.painel_responsavel_id AS user_id
        FROM pend
        JOIN public.projects p ON p.id = pend.project_id
       WHERE p.painel_responsavel_id IS NOT NULL
      UNION
      SELECT pend.project_id, pend.n, pe.engineer_user_id
        FROM pend
        JOIN public.projects p ON p.id = pend.project_id
        JOIN public.project_engineers pe ON pe.project_id = pend.project_id
       WHERE p.painel_responsavel_id IS NULL
         AND pe.is_primary
    )
    SELECT d.user_id, count(*) AS obras, sum(d.n) AS atividades
      FROM dest d
      JOIN public.users_profile up ON up.id = d.user_id AND up.status = 'ativo'
     GROUP BY d.user_id
  LOOP
    -- No máximo um aviso por pessoa por dia.
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.notifications n
       WHERE n.user_id = r.user_id
         AND n.action_url = v_url
         AND n.created_at >= v_day_start
    );

    INSERT INTO public.notifications (user_id, type, title, body, action_url)
    VALUES (
      r.user_id,
      'general',
      'Cronograma: ' || r.atividades ||
        CASE WHEN r.atividades = 1 THEN ' atividade aguardando' ELSE ' atividades aguardando' END ||
        ' atualização',
      'Início ou término previsto já passou e a data real não foi informada, em ' ||
        r.obras || CASE WHEN r.obras = 1 THEN ' obra sua.' ELSE ' obras suas.' END,
      v_url
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_schedule_alerts_daily() FROM PUBLIC, anon, authenticated;

-- Agendamentos. Sem pg_cron/pg_net, segue sem falhar (mesmo padrão das
-- migrations anteriores); basta ativar a extensão e rodar de novo.
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron indisponível (%). Ative a extensão e rode esta migration de novo.', SQLERRM;
    RETURN;
  END;

  BEGIN PERFORM cron.unschedule('avisos-cronograma-diario'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('resumo-notificacoes-email-diario'); EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 07h30 de Brasília (10h30 UTC), de segunda a sexta.
  PERFORM cron.schedule(
    'avisos-cronograma-diario',
    '30 10 * * 1-5',
    'SELECT public.notify_schedule_alerts_daily();'
  );

  -- 08h de Brasília (11h UTC), todos os dias: e-mail com as não lidas das
  -- últimas 24h. Chave anon (pública), como nos demais jobs.
  PERFORM cron.schedule(
    'resumo-notificacoes-email-diario',
    '0 11 * * *',
    $job$
    SELECT net.http_post(
      url := 'https://fvblcyzdcqkiihyhfrrw.supabase.co/functions/v1/send-notification-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2YmxjeXpkY3FraWloeWhmcnJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTc3MzUsImV4cCI6MjA4MTMzMzczNX0.zrSOoXrdBh4QZLTbyprpuhXFalbWl9kHaRzBJjcEMIk',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2YmxjeXpkY3FraWloeWhmcnJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTc3MzUsImV4cCI6MjA4MTMzMzczNX0.zrSOoXrdBh4QZLTbyprpuhXFalbWl9kHaRzBJjcEMIk'
      ),
      body := '{}'::jsonb
    );
    $job$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Não foi possível agendar os avisos (%).', SQLERRM;
END $$;
