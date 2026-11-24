-- E-mail das marcações em observações internas (só equipe; o cliente nunca recebe).
--
--   marcado   -> para quem foi marcado, na hora.
--   resolvido -> para quem pediu, quando a pessoa marcada resolve.
--   lembrete  -> 1 por dia útil para quem foi marcado, enquanto a pendência
--                estiver aberta há mais de 24 horas úteis; cópia para o
--                responsável da obra. (enfileirado pela função de borda)
--
-- Como funciona: os gatilhos abaixo só colocam o e-mail numa fila
-- (internal_mention_emails). Quem envia é a função `send-mention-emails`,
-- chamada na hora pelo gatilho (pg_net) e, de hora em hora, pelo pg_cron —
-- que também reenvia o que falhou. Se o envio falhar, a marcação e a
-- notificação no portal continuam valendo.
--
-- Só cria objetos novos. Não altera dados existentes.

CREATE TABLE IF NOT EXISTS public.internal_mention_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mention_id uuid NOT NULL REFERENCES public.project_internal_note_mentions(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('marcado', 'resolvido', 'lembrete')),
  dia date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date),
  to_user_id uuid NOT NULL,
  cc_user_id uuid,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'enviando', 'enviado', 'falhou', 'ignorado')),
  attempts integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  CONSTRAINT internal_mention_emails_um_por_dia UNIQUE (mention_id, kind, dia)
);
CREATE INDEX IF NOT EXISTS idx_internal_mention_emails_fila
  ON public.internal_mention_emails (created_at)
  WHERE status IN ('pendente', 'falhou', 'enviando');

COMMENT ON TABLE public.internal_mention_emails IS
  'Fila e registro dos e-mails de marcação entre a equipe. Só staff lê; ninguém grava pelo app.';

CREATE TABLE IF NOT EXISTS public.internal_mention_email_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  cron_token text NOT NULL
);
INSERT INTO public.internal_mention_email_config (id, cron_token)
VALUES (true, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.internal_mention_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_mention_email_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.internal_mention_emails FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.internal_mention_email_config FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.internal_mention_emails TO authenticated;
GRANT ALL ON public.internal_mention_emails TO service_role;
GRANT ALL ON public.internal_mention_email_config TO service_role;

DROP POLICY IF EXISTS "Staff lê e-mails de marcação" ON public.internal_mention_emails;
CREATE POLICY "Staff lê e-mails de marcação"
  ON public.internal_mention_emails FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
-- internal_mention_email_config: sem grant e sem policy — o app não lê o token.

-- Confere o token (usado pela função de borda, com a chave de serviço).
CREATE OR REPLACE FUNCTION public.internal_mention_email_token_ok(p_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.internal_mention_email_config
                 WHERE cron_token = p_token AND length(coalesce(p_token, '')) >= 32)
$$;

-- Chama a função de envio (assíncrono, depois do commit). Nunca derruba quem chamou.
CREATE OR REPLACE FUNCTION public.internal_mention_emails_kick()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://fvblcyzdcqkiihyhfrrw.supabase.co/functions/v1/send-mention-emails',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-mention-email-token', (SELECT cron_token FROM public.internal_mention_email_config WHERE id)),
    body := '{"origem":"gatilho"}'::jsonb);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'internal_mention_emails_kick: %', SQLERRM;
END $$;

-- Gatilho: coloca na fila quando alguém é marcado, marcado de novo ou resolve.
CREATE OR REPLACE FUNCTION public.internal_mention_emails_enqueue()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_kind text;
  v_to uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.archived_at IS NULL AND NEW.resolved_at IS NULL THEN
      v_kind := 'marcado'; v_to := NEW.mentioned_user_id;
    END IF;
  ELSIF OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL AND NEW.resolved_at IS NULL THEN
    v_kind := 'marcado'; v_to := NEW.mentioned_user_id;
  ELSIF OLD.resolved_at IS NULL AND NEW.resolved_at IS NOT NULL AND NEW.archived_at IS NULL THEN
    v_kind := 'resolvido'; v_to := NEW.requested_by;
  END IF;

  IF v_kind IS NULL OR v_to IS NULL THEN RETURN NEW; END IF;
  -- Ninguém recebe e-mail do que ela mesma fez.
  IF v_kind = 'marcado' AND NEW.mentioned_user_id = NEW.requested_by THEN RETURN NEW; END IF;
  IF v_kind = 'resolvido' AND NEW.requested_by = NEW.resolved_by THEN RETURN NEW; END IF;

  BEGIN
    INSERT INTO public.internal_mention_emails (mention_id, kind, to_user_id)
    VALUES (NEW.id, v_kind, v_to)
    ON CONFLICT (mention_id, kind, dia) DO NOTHING;
    IF FOUND THEN PERFORM public.internal_mention_emails_kick(); END IF;
  EXCEPTION WHEN OTHERS THEN
    -- O e-mail é um extra: a marcação não pode falhar por causa dele.
    RAISE WARNING 'internal_mention_emails_enqueue: %', SQLERRM;
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_internal_mention_emails_enqueue ON public.project_internal_note_mentions;
CREATE TRIGGER trg_internal_mention_emails_enqueue
  AFTER INSERT OR UPDATE OF resolved_at, archived_at ON public.project_internal_note_mentions
  FOR EACH ROW EXECUTE FUNCTION public.internal_mention_emails_enqueue();

-- Pega um lote para enviar, sem que duas rodadas peguem o mesmo e-mail.
-- 'enviando' parado há mais de 15 min volta para a fila; até 3 tentativas.
CREATE OR REPLACE FUNCTION public.internal_mention_emails_claim(p_limit integer DEFAULT 30)
RETURNS SETOF public.internal_mention_emails
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.internal_mention_emails e
     SET status = 'enviando', attempts = e.attempts + 1, claimed_at = now()
   WHERE e.id IN (
     SELECT id FROM public.internal_mention_emails
      WHERE attempts < 3
        AND (status IN ('pendente', 'falhou')
             OR (status = 'enviando' AND claimed_at < now() - interval '15 minutes'))
      ORDER BY created_at
      LIMIT greatest(1, least(coalesce(p_limit, 30), 100))
      FOR UPDATE SKIP LOCKED)
  RETURNING e.*
$$;

REVOKE ALL ON FUNCTION public.internal_mention_email_token_ok(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.internal_mention_emails_kick() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.internal_mention_emails_enqueue() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.internal_mention_emails_claim(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.internal_mention_email_token_ok(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.internal_mention_emails_claim(integer) TO service_role;

-- De hora em hora (minuto 10): reenvia o que falhou e gera os lembretes do dia.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    BEGIN
      PERFORM cron.unschedule('mencoes-email-de-hora-em-hora');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule('mencoes-email-de-hora-em-hora', '10 * * * *',
      $job$ SELECT public.internal_mention_emails_kick() $job$);
  ELSE
    RAISE NOTICE 'pg_cron/pg_net ausentes: e-mail de marcação só sai na hora, sem lembrete.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Agendamento do e-mail de marcação não criado: %', SQLERRM;
END $$;
