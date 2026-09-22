CREATE OR REPLACE FUNCTION public.notify_executivo_aprovado()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  c_destinatarios constant text[] := ARRAY[
    'bianca@bwild.com.br',
    'mariana@bewild.com.br',
    'bruna.campelo@bewild.com.br'
  ];
  c_project_url constant text := 'https://fvblcyzdcqkiihyhfrrw.supabase.co';
  c_anon_key constant text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2YmxjeXpkY3FraWloeWhmcnJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTc3MzUsImV4cCI6MjA4MTMzMzczNX0.zrSOoXrdBh4QZLTbyprpuhXFalbWl9kHaRzBJjcEMIk';
  v_email text;
  v_user_id uuid;
  v_user_ids uuid[] := ARRAY[]::uuid[];
  v_titulo text;
BEGIN
  IF NEW.painel_etapa IS DISTINCT FROM OLD.painel_etapa
     AND NEW.painel_etapa::text = 'Executivo Aprovado' THEN
    BEGIN
      v_titulo := 'Executivo aprovado — ' || COALESCE(NULLIF(btrim(NEW.name), ''), 'obra sem nome');

      FOREACH v_email IN ARRAY c_destinatarios LOOP
        SELECT up.id INTO v_user_id
        FROM public.users_profile up
        WHERE lower(up.email) = lower(v_email)
          AND up.status = 'ativo'
        LIMIT 1;

        IF v_user_id IS NULL THEN
          RAISE WARNING 'notify_executivo_aprovado: destinatario % nao encontrado ou inativo', v_email;
          CONTINUE;
        END IF;

        INSERT INTO public.notifications (user_id, project_id, type, title, body, action_url)
        VALUES (
          v_user_id,
          NEW.id,
          'stage_changed',
          v_titulo,
          'O projeto executivo desta obra foi aprovado. Ela já pode entrar no cronograma de contas.',
          '/obra/' || NEW.id
        );
        v_user_ids := array_append(v_user_ids, v_user_id);
      END LOOP;

      IF array_length(v_user_ids, 1) > 0 THEN
        PERFORM net.http_post(
          url := c_project_url || '/functions/v1/send-executivo-aprovado',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', c_anon_key,
            'Authorization', 'Bearer ' || c_anon_key
          ),
          body := jsonb_build_object(
            'project_id', NEW.id,
            'user_ids', to_jsonb(v_user_ids)
          )
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_executivo_aprovado falhou para a obra %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NULL;
END;
$function$;