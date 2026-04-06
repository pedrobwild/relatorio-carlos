
CREATE OR REPLACE FUNCTION public.auto_assign_default_project_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_default_emails text[] := ARRAY['lucas.serra@bwild.com.br', 'guilherme@bwild.com.br'];
  v_email text;
BEGIN
  -- 1. Add all active admin users as owner
  FOR v_user_id IN
    SELECT id FROM public.users_profile
    WHERE perfil = 'admin' AND status = 'ativo'
  LOOP
    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES (NEW.id, v_user_id, 'owner')
    ON CONFLICT (project_id, user_id) DO NOTHING;
  END LOOP;

  -- 2. Add default staff members
  FOREACH v_email IN ARRAY v_default_emails
  LOOP
    SELECT id INTO v_user_id
    FROM public.users_profile
    WHERE email = v_email AND status = 'ativo'
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
      INSERT INTO public.project_members (project_id, user_id, role)
      VALUES (NEW.id, v_user_id, 'engineer')
      ON CONFLICT (project_id, user_id) DO NOTHING;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger fires after insert on projects
CREATE TRIGGER trg_auto_assign_default_members
AFTER INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_default_project_members();
