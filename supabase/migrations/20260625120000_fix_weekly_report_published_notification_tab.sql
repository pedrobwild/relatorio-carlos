-- Bug: clientes não conseguem acessar os relatórios a partir da notificação.
--
-- Causa raiz: o gatilho notify_weekly_report_published (migration 20260322090903)
-- grava a notificação "Relatório Semana N disponível" com action_url apontando
-- para `/obra/{project_id}?tab=evolucao` — a aba de Evolução (curva S), e NÃO a
-- aba de Relatórios. O sino de notificações (NotificationBell / MobileNotifications)
-- navega direto para esse action_url, então o cliente que toca na notificação cai
-- na tela errada e nunca chega ao relatório. O destino correto é `?tab=relatorios`
-- (mesmo padrão das demais notificações: ?tab=documentos, ?tab=financeiro, etc.).
--
-- Correções:
--   1) Apontar a notificação para `?tab=relatorios`.
--   2) Notificar TODOS os clientes vinculados ao projeto — tanto os legados em
--      project_customers quanto os vinculados via project_members (role 'viewer',
--      criado pelo auto-link em 20260509012003). Antes, clientes que só existiam
--      em project_members não recebiam a notificação.
--   3) Backfill: corrigir o action_url das notificações de relatório já gravadas.

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
  -- Only notify on insert or when content is first populated
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.data IS DISTINCT FROM NEW.data AND NEW.data IS NOT NULL) THEN
    SELECT name INTO v_project_name FROM projects WHERE id = NEW.project_id;

    FOR v_user_id IN
      -- Clientes legados vinculados por project_customers
      SELECT customer_user_id AS uid
      FROM project_customers
      WHERE project_id = NEW.project_id AND customer_user_id IS NOT NULL
      UNION
      -- Clientes vinculados pelo sistema unificado (project_members role 'viewer')
      SELECT user_id AS uid
      FROM project_members
      WHERE project_id = NEW.project_id AND role = 'viewer'
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

-- Backfill: notificações de relatório já gravadas apontam para a aba errada.
UPDATE public.notifications
SET action_url = replace(action_url, '?tab=evolucao', '?tab=relatorios')
WHERE type = 'report_published'
  AND action_url LIKE '%?tab=evolucao';
