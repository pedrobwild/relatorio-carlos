-- =====================================================================
-- RELATÓRIO SEMANAL: avisar o cliente NA HORA em que fica visível
--
-- POR QUE ISTO EXISTE
-- O aviso "Relatório Semana N disponível" saía quando alguém da equipe
-- salvava o relatório — dias antes de ele ficar visível (sexta, 18h) — e
-- não saía nunca na semana alimentada só pelo diário de obra. O cliente
-- precisa ser avisado quando o relatório de fato aparece para ele.
--
-- O QUE FAZ
--   1. `weekly_report_release_notices`: uma linha por relatório cujo aviso
--      de liberação já saiu (para avisar uma vez só). Tabela à parte para
--      não mexer em `weekly_reports.updated_at`, que é a base do controle de
--      conflito do editor. Os relatórios JÁ visíveis hoje entram como
--      avisados: ninguém recebe aviso retroativo.
--   2. `weekly_reports_notify_released()`: avisa os clientes de cada
--      relatório que ficou visível e ainda não teve aviso. Reexecutável.
--   3. pg_cron: roda a função uma vez por hora, no minuto 5 (job
--      `weekly-reports-aviso-liberacao`). Se o pg_cron não estiver
--      disponível, a migration NÃO falha: só registra um aviso, e vale o
--      item 4.
--   4. `notify_weekly_report_published` (gatilho de gravação):
--        - relatório ainda NÃO visível e o job agendado existe → não avisa
--          agora; o job avisa na liberação;
--        - relatório ainda não visível e NÃO há job → avisa na gravação,
--          como sempre foi (nunca ficar sem aviso);
--        - relatório JÁ visível e o conteúdo mudou → avisa na hora, como
--          antes;
--        - gravação automática do diário de obra em relatório ainda não
--          visível → não avisa na gravação (o job avisa na liberação); em
--          relatório já visível (relato atrasado) → avisa na hora.
--
-- SEGURANÇA
-- Tabela sem acesso para anon/authenticated (só as funções SECURITY
-- DEFINER e service_role). A função de aviso não é chamável pelo app.
-- Idempotente.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.weekly_report_release_notices (
  report_id   uuid PRIMARY KEY REFERENCES public.weekly_reports(id) ON DELETE CASCADE,
  notified_at timestamptz NOT NULL DEFAULT now(),
  recipients  integer NOT NULL DEFAULT 0
);

ALTER TABLE public.weekly_report_release_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.weekly_report_release_notices FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.weekly_report_release_notices IS
  'Relatórios semanais cujo aviso de liberação ao cliente já saiu. Só funções internas escrevem.';

-- Sem aviso retroativo: o que já está visível conta como avisado.
INSERT INTO public.weekly_report_release_notices (report_id, notified_at, recipients)
SELECT w.id, now(), 0
FROM public.weekly_reports w
WHERE w.available_at IS NOT NULL AND w.available_at <= now()
ON CONFLICT (report_id) DO NOTHING;

-- O job de aviso na liberação está agendado? (pg_cron pode não existir.)
CREATE OR REPLACE FUNCTION public.weekly_reports_release_job_active()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active boolean := false;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RETURN false;
  END IF;
  EXECUTE 'SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = $1 AND active)'
    INTO v_active USING 'weekly-reports-aviso-liberacao';
  RETURN coalesce(v_active, false);
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.weekly_reports_release_job_active() FROM PUBLIC, anon, authenticated;

-- Avisa os clientes de um relatório (os mesmos destinatários de sempre).
CREATE OR REPLACE FUNCTION public.weekly_report_notify_customers(p_report public.weekly_reports)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_project_name text;
  v_count integer := 0;
BEGIN
  SELECT name INTO v_project_name FROM projects WHERE id = p_report.project_id;

  FOR v_user_id IN
    SELECT customer_user_id AS uid
    FROM project_customers
    WHERE project_id = p_report.project_id AND customer_user_id IS NOT NULL
    UNION
    SELECT user_id AS uid
    FROM project_members
    WHERE project_id = p_report.project_id AND role IN ('viewer', 'customer')
  LOOP
    PERFORM create_notification(
      v_user_id,
      'report_published',
      'Relatório Semana ' || p_report.week_number || ' disponível',
      'O relatório semanal de ' || COALESCE(v_project_name, 'seu projeto') || ' está pronto.',
      p_report.project_id,
      '/obra/' || p_report.project_id || '?tab=relatorios'
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.weekly_report_notify_customers(public.weekly_reports) FROM PUBLIC, anon, authenticated;

-- Roda pelo agendador: avisa o que ficou visível e ainda não teve aviso.
CREATE OR REPLACE FUNCTION public.weekly_reports_notify_released()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.weekly_reports;
  v_reports integer := 0;
  v_recipients integer;
BEGIN
  FOR r IN
    SELECT w.*
    FROM public.weekly_reports w
    WHERE w.available_at IS NOT NULL
      AND w.available_at <= now()
      -- Trava de segurança: nunca desenterra relatório antigo.
      AND w.available_at > now() - interval '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.weekly_report_release_notices n WHERE n.report_id = w.id
      )
    ORDER BY w.available_at
    FOR UPDATE OF w SKIP LOCKED
  LOOP
    -- Reserva primeiro: duas execuções ao mesmo tempo não avisam em dobro.
    INSERT INTO public.weekly_report_release_notices (report_id)
    VALUES (r.id)
    ON CONFLICT (report_id) DO NOTHING;
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_recipients := public.weekly_report_notify_customers(r);
    UPDATE public.weekly_report_release_notices SET recipients = v_recipients WHERE report_id = r.id;
    v_reports := v_reports + 1;
  END LOOP;

  RETURN v_reports;
END;
$$;

REVOKE ALL ON FUNCTION public.weekly_reports_notify_released() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.weekly_reports_notify_released() TO service_role;

-- Gatilho de gravação: avisa na hora só o que já está visível (ou tudo, se
-- não houver agendador).
CREATE OR REPLACE FUNCTION public.notify_weekly_report_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released boolean := NEW.available_at IS NULL OR NEW.available_at <= now();
BEGIN
  -- Gravação automática do diário de obra antes da liberação: não é
  -- "relatório disponível". (Relato que chega depois de a semana já estar
  -- visível segue adiante e avisa: o cliente passa a ver conteúdo novo.)
  IF coalesce(current_setting('bwild.diario_feed', true), '') = 'on'
     AND (NOT v_released OR TG_OP = 'INSERT') THEN
    -- No INSERT o diário só cria a casca do relatório; o conteúdo entra no
    -- UPDATE logo em seguida, e é ele que avisa (um aviso só).
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.data IS DISTINCT FROM NEW.data AND NEW.data IS NOT NULL) THEN
    -- Ainda não visível: o aviso sai na liberação, pelo agendador.
    IF NOT v_released AND public.weekly_reports_release_job_active() THEN
      RETURN NEW;
    END IF;

    PERFORM public.weekly_report_notify_customers(NEW);

    -- Avisado agora: o agendador não repete.
    IF v_released THEN
      INSERT INTO public.weekly_report_release_notices (report_id)
      VALUES (NEW.id)
      ON CONFLICT (report_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Agenda uma vez por hora (minuto 5): sexta 18h vira aviso às 18h05. Sem pg_cron, segue sem falhar (ver item 3).
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron indisponível (%). Ative a extensão e rode esta migration de novo.', SQLERRM;
    RETURN;
  END;

  BEGIN
    PERFORM cron.unschedule('weekly-reports-aviso-liberacao');
  EXCEPTION WHEN OTHERS THEN
    NULL; -- job ainda não existia
  END;

  PERFORM cron.schedule(
    'weekly-reports-aviso-liberacao',
    '5 * * * *',
    'SELECT public.weekly_reports_notify_released();'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Não foi possível agendar o aviso de liberação (%).', SQLERRM;
END $$;
