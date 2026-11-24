-- =====================================================================
-- RELATÓRIO SEMANAL: liberação para o cliente na SEXTA, às 18h
--
-- ANTES: o relatório ficava visível ao cliente no dia seguinte ao fim da
-- semana, às 20h (sábado, 20h). AGORA: no próprio dia em que a semana fecha
-- (`week_end`, a sexta), às 18h, horário de Brasília. A mesma regra está em
-- `WeeklyReportsHistory.tsx` (REPORT_AVAILABLE_HOUR / DAYS_AFTER_WEEK_END).
--
-- 1. `weekly_reports_set_fields`: só muda a conta do `available_at` de
--    relatório novo. O resto da função é o mesmo de 20260127123047.
-- 2. Relatórios que AINDA não ficaram visíveis e carregam a data da regra
--    antiga passam para a nova. Data posta à mão (diferente da regra antiga)
--    e relatório já visível não mudam.
-- 3. `notify_weekly_report_published`: o diário de obra grava no relatório
--    semanal a cada envio, dias antes da sexta. Essas gravações não avisam o
--    cliente de "relatório disponível" (marcadas com `bwild.diario_feed`,
--    local à transação). Gravação de gente continua avisando como antes.
-- Idempotente.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.weekly_reports_set_fields()
RETURNS trigger AS $$
BEGIN
  -- Preenche available_at: no dia em que a semana fecha, às 18:00 (horário de Brasília)
  IF NEW.available_at IS NULL THEN
    NEW.available_at := ((NEW.week_end::timestamp + interval '18 hours') AT TIME ZONE 'America/Sao_Paulo');
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS NULL THEN
      NEW.created_by := auth.uid();
    END IF;
    IF NEW.created_at IS NULL THEN
      NEW.created_at := now();
    END IF;
  END IF;

  NEW.updated_by := auth.uid();
  NEW.updated_at := now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Relatórios ainda não visíveis, com a data da regra antiga → regra nova.
-- Sem os gatilhos de campos: `updated_at` não muda (não cria conflito para
-- quem está com o relatório aberto) e ninguém é avisado.
DO $$
BEGIN
  ALTER TABLE public.weekly_reports DISABLE TRIGGER trg_weekly_reports_set_fields;
  UPDATE public.weekly_reports
  SET available_at = ((week_end::timestamp + interval '18 hours') AT TIME ZONE 'America/Sao_Paulo')
  WHERE available_at > now()
    AND available_at = ((week_end::timestamp + interval '1 day' + interval '20 hours') AT TIME ZONE 'America/Sao_Paulo');
  ALTER TABLE public.weekly_reports ENABLE TRIGGER trg_weekly_reports_set_fields;
END $$;

CREATE OR REPLACE FUNCTION public.notify_weekly_report_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_project_name TEXT;
BEGIN
  -- Gravação automática do diário de obra: não é "relatório disponível".
  IF coalesce(current_setting('bwild.diario_feed', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.data IS DISTINCT FROM NEW.data AND NEW.data IS NOT NULL) THEN
    SELECT name INTO v_project_name FROM projects WHERE id = NEW.project_id;

    FOR v_user_id IN
      SELECT customer_user_id AS uid
      FROM project_customers
      WHERE project_id = NEW.project_id AND customer_user_id IS NOT NULL
      UNION
      SELECT user_id AS uid
      FROM project_members
      WHERE project_id = NEW.project_id AND role IN ('viewer', 'customer')
    LOOP
      PERFORM create_notification(
        v_user_id,
        'report_published',
        'Relatório Semana ' || NEW.week_number || ' disponível',
        'O relatório semanal de ' || COALESCE(v_project_name, 'seu projeto') || ' está pronto.',
        NEW.project_id,
        '/obra/' || NEW.project_id || '?tab=relatorios'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;
