-- Follow-up de 20260625120000 (PR #90): a query de destinatários da notificação
-- de relatório só incluía project_members com role 'viewer'. Mas o enum
-- project_role também tem 'customer' (exposto como "Cliente" no editor de
-- equipe). Um cliente vinculado apenas via project_members com role 'customer'
-- (sem linha legada em project_customers) não recebia a notificação.
--
-- Correção: incluir role IN ('viewer', 'customer') na query de destinatários.

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
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.data IS DISTINCT FROM NEW.data AND NEW.data IS NOT NULL) THEN
    SELECT name INTO v_project_name FROM projects WHERE id = NEW.project_id;

    FOR v_user_id IN
      -- Clientes legados vinculados por project_customers
      SELECT customer_user_id AS uid
      FROM project_customers
      WHERE project_id = NEW.project_id AND customer_user_id IS NOT NULL
      UNION
      -- Clientes vinculados pelo sistema unificado (project_members nas roles
      -- de cliente: 'viewer' e 'customer')
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
