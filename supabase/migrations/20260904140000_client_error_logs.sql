-- Telemetria de erro de cliente.
--
-- POR QUE ISTO EXISTE
-- Em 04/09/2026 uma usuária viu "Estamos com instabilidade no servidor" e,
-- depois de recarregar, o Painel de Obras ficou preso no esqueleto. Investigando,
-- descartei — com evidência — banco travado, pool esgotado, sessão morta, conta
-- com problema e RLS. Todos sãos. Mas NÃO foi possível dizer o que ela recebeu,
-- porque src/lib/errorLogger.ts só escrevia no console do navegador dela.
--
-- Um erro pontual em um usuário era, até aqui, infalsificável: não dava para
-- confirmar nem descartar nada. Esta tabela fecha essa lacuna.
--
-- PRIVACIDADE: guardamos o suficiente para diagnosticar e nada além. Sem corpo
-- de requisição, sem token, sem conteúdo de formulário. `message` é truncada.
CREATE TABLE IF NOT EXISTS public.client_error_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  context       text,        -- de onde veio: 'useUserRole', 'usePainelObras'…
  message       text NOT NULL,
  error_code    text,        -- PGRST002, P0001, BWILD_OFFLINE…
  http_status   integer,
  route         text,        -- pathname, sem query string
  online        boolean,     -- navigator.onLine no momento
  user_agent    text,
  extra         jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.client_error_logs IS
  'Erros capturados no navegador. Serve para diagnosticar relatos individuais que não deixam rastro no servidor.';

-- Consultas de diagnóstico são sempre "o que aconteceu com fulano por volta de tal hora".
CREATE INDEX IF NOT EXISTS client_error_logs_created_at_idx
  ON public.client_error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS client_error_logs_user_created_idx
  ON public.client_error_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS client_error_logs_code_created_idx
  ON public.client_error_logs (error_code, created_at DESC);

ALTER TABLE public.client_error_logs ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado registra o PRÓPRIO erro. `user_id` é obrigado a ser o
-- dele: sem isto, um usuário poderia forjar log em nome de outro.
DROP POLICY IF EXISTS "Usuário registra o próprio erro" ON public.client_error_logs;
CREATE POLICY "Usuário registra o próprio erro"
  ON public.client_error_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Leitura só para admin. Log de erro pode conter rota e agente do usuário.
DROP POLICY IF EXISTS "Admin lê os erros de cliente" ON public.client_error_logs;
CREATE POLICY "Admin lê os erros de cliente"
  ON public.client_error_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

REVOKE ALL ON TABLE public.client_error_logs FROM PUBLIC;
REVOKE ALL ON TABLE public.client_error_logs FROM anon;
GRANT INSERT ON TABLE public.client_error_logs TO authenticated;
GRANT SELECT ON TABLE public.client_error_logs TO authenticated;
GRANT ALL ON TABLE public.client_error_logs TO service_role;

-- Retenção: 90 dias bastam para investigar um relato. Sem isto a tabela cresce
-- para sempre — e o custo de um log é justamente ser barato.
CREATE OR REPLACE FUNCTION public.purge_client_error_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_removidos integer;
BEGIN
  DELETE FROM public.client_error_logs
  WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_removidos = ROW_COUNT;
  RETURN v_removidos;
END;
$function$;

REVOKE ALL ON FUNCTION public.purge_client_error_logs() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_client_error_logs() FROM anon;
GRANT EXECUTE ON FUNCTION public.purge_client_error_logs() TO service_role;
