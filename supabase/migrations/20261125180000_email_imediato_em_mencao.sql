-- E-mail na hora em que alguém é marcado numa observação interna.
--
-- A notificação `internal_mention` já entra no sino no mesmo instante; o
-- e-mail só saía no resumo diário. Este trigger chama a edge function
-- send-mention-email (via pg_net) logo após o insert. Falha no disparo nunca
-- impede a menção: vira apenas um WARNING.

CREATE OR REPLACE FUNCTION public.notify_mention_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := 'https://fvblcyzdcqkiihyhfrrw.supabase.co/functions/v1/send-mention-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2YmxjeXpkY3FraWloeWhmcnJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTc3MzUsImV4cCI6MjA4MTMzMzczNX0.zrSOoXrdBh4QZLTbyprpuhXFalbWl9kHaRzBJjcEMIk',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2YmxjeXpkY3FraWloeWhmcnJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTc3MzUsImV4cCI6MjA4MTMzMzczNX0.zrSOoXrdBh4QZLTbyprpuhXFalbWl9kHaRzBJjcEMIk'
      ),
      body := jsonb_build_object('notification_id', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_mention_email: falha ao disparar e-mail (%).', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_mention_email() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notifications_mention_email ON public.notifications;
CREATE TRIGGER trg_notifications_mention_email
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  WHEN (NEW.type = 'internal_mention')
  EXECUTE FUNCTION public.notify_mention_email();
