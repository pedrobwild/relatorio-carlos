-- Notifica quando um card do Painel de Obras entra na etapa "Executivo Aprovado".
--
-- Pedido: a Mariana precisa saber que a obra teve o projeto executivo aprovado
-- e, portanto, ja pode entrar no cronograma de contas.
--
-- POR QUE UM TRIGGER, E NAO CODIGO NO CLIENTE
-- Hoje so src/hooks/usePainelObras.ts:144 escreve painel_etapa, mas o gatilho
-- cobre qualquer caminho futuro (agentes de sync, edge functions, Lovable,
-- correcao manual via SQL) e nao depende de ninguem lembrar de chamar. E o
-- mesmo principio de docs/SECURITY_PATTERNS.md: a regra vive no banco.
--
-- A insercao em notifications ja rende DOIS canais sem trabalho extra:
--   * o sino do app (src/hooks/useNotifications.ts)
--   * o e-mail, porque supabase/functions/send-notification-digest varre toda
--     notificacao nao lida das ultimas 24h e envia via Resend
--
-- SEGURANCA OPERACIONAL: a notificacao NUNCA pode derrubar a mudanca de etapa.
-- Um trigger AFTER que levanta excecao aborta a transacao inteira — ou seja, um
-- problema no envio de aviso impediria o time de mover cards no painel. Por isso
-- todo o corpo esta dentro de um bloco EXCEPTION que apenas registra WARNING.
CREATE OR REPLACE FUNCTION public.notify_executivo_aprovado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  -- Destinatario configurado por e-mail. Para trocar a pessoa responsavel pelo
  -- cronograma de contas, altere ESTA linha (e so ela).
  c_email_destinatario constant text := 'mariana@bewild.com.br';
  v_user_id uuid;
BEGIN
  -- `UPDATE OF painel_etapa` dispara sempre que a coluna aparece no SET, mesmo
  -- que o valor nao mude. O IS DISTINCT FROM garante que so avisamos numa
  -- transicao real para a etapa.
  IF NEW.painel_etapa IS DISTINCT FROM OLD.painel_etapa
     AND NEW.painel_etapa::text = 'Executivo Aprovado' THEN
    BEGIN
      SELECT up.id INTO v_user_id
      FROM public.users_profile up
      WHERE lower(up.email) = c_email_destinatario
        AND up.status = 'ativo'
      LIMIT 1;

      IF v_user_id IS NULL THEN
        -- Pessoa desligada ou e-mail alterado: avisa no log em vez de falhar
        -- silenciosamente para sempre.
        RAISE WARNING 'notify_executivo_aprovado: destinatario % nao encontrado ou inativo', c_email_destinatario;
      ELSE
        INSERT INTO public.notifications (user_id, project_id, type, title, body, action_url)
        VALUES (
          v_user_id,
          NEW.id,
          'stage_changed',
          'Executivo aprovado — ' || COALESCE(NULLIF(btrim(NEW.name), ''), 'obra sem nome'),
          'O projeto executivo desta obra foi aprovado. Ela já pode entrar no cronograma de contas.',
          '/obra/' || NEW.id
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Jamais bloquear a movimentacao do card por causa de um aviso.
      RAISE WARNING 'notify_executivo_aprovado falhou para a obra %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NULL; -- AFTER trigger: o valor de retorno e ignorado.
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_executivo_aprovado ON public.projects;
CREATE TRIGGER trg_notify_executivo_aprovado
AFTER UPDATE OF painel_etapa ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.notify_executivo_aprovado();
