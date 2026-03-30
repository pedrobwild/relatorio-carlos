
-- =============================================
-- Trigger: notify on NC creation and status changes
-- Inserts into notifications table for responsible user and project managers
-- =============================================

CREATE OR REPLACE FUNCTION public.notify_nc_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nc_title text;
  v_project_id uuid;
  v_responsible_user_id uuid;
  v_status text;
  v_action_url text;
  v_manager_id uuid;
BEGIN
  v_nc_title := NEW.title;
  v_project_id := NEW.project_id;
  v_responsible_user_id := NEW.responsible_user_id;
  v_status := NEW.status;
  v_action_url := '/projeto/' || NEW.project_id || '/vistorias';

  -- On INSERT: notify responsible user
  IF TG_OP = 'INSERT' AND v_responsible_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, project_id, title, body, type, action_url)
    VALUES (
      v_responsible_user_id,
      v_project_id,
      'Nova NC atribuída a você',
      'NC: ' || v_nc_title,
      'nc_created',
      v_action_url
    );
  END IF;

  -- On UPDATE: notify on status change
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Notify responsible user about status change
    IF v_responsible_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, project_id, title, body, type, action_url)
      VALUES (
        v_responsible_user_id,
        v_project_id,
        'NC atualizada: ' || v_nc_title,
        'Status alterado para: ' || v_status,
        'nc_status_changed',
        v_action_url
      );
    END IF;

    -- Notify project managers when NC reaches pending_approval
    IF NEW.status = 'pending_approval' THEN
      FOR v_manager_id IN
        SELECT pm.user_id
        FROM public.project_members pm
        WHERE pm.project_id = v_project_id
          AND pm.role IN ('admin', 'manager')
          AND pm.user_id IS DISTINCT FROM v_responsible_user_id
      LOOP
        INSERT INTO public.notifications (user_id, project_id, title, body, type, action_url)
        VALUES (
          v_manager_id,
          v_project_id,
          'NC aguardando aprovação',
          'NC: ' || v_nc_title,
          'nc_pending_approval',
          v_action_url
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop if exists to avoid duplicates
DROP TRIGGER IF EXISTS trg_notify_nc_changes ON public.non_conformities;

CREATE TRIGGER trg_notify_nc_changes
  AFTER INSERT OR UPDATE ON public.non_conformities
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_nc_changes();
