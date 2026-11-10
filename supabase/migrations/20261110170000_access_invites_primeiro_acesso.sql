-- Link de primeiro acesso: a equipe gera um link (válido por 7 dias, uso
-- único) e manda ao cliente, que cria a própria senha em /primeiro-acesso.
--
-- Por que não o link de recuperação do Supabase: ele vence em ~1h e é
-- "gasto" pela pré-visualização de links do WhatsApp/Gmail (o robô abre a
-- URL antes do cliente). Aqui o link aponta para uma página do portal e o
-- token só é consumido quando o cliente salva a senha.
--
-- Idempotente: pode ser reaplicada sem erro.

CREATE TABLE IF NOT EXISTS public.access_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS access_invites_user_id_idx
  ON public.access_invites (user_id);

-- Só as funções abaixo (SECURITY DEFINER) leem/gravam a tabela.
ALTER TABLE public.access_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.access_invites FROM anon, authenticated;

-- Gera o link. Equipe pode gerar para clientes; para contas da equipe, só
-- admin ativo (mesma regra de assertCanManageAccount nas Edge Functions).
CREATE OR REPLACE FUNCTION public.create_access_invite(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _caller uuid := auth.uid();
  _token text;
  _target_privileged boolean;
  _caller_admin boolean;
  _banned timestamptz;
BEGIN
  IF _caller IS NULL OR NOT public.is_staff(_caller) THEN
    RAISE EXCEPTION 'invite_forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT banned_until INTO _banned FROM auth.users WHERE id = _user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_user_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF _banned IS NOT NULL AND _banned > now() THEN
    RAISE EXCEPTION 'invite_user_blocked' USING ERRCODE = 'P0001';
  END IF;

  _target_privileged :=
    public.is_staff(_user_id)
    OR EXISTS (SELECT 1 FROM public.users_profile
               WHERE id = _user_id AND perfil IS NOT NULL AND perfil <> 'customer')
    OR EXISTS (SELECT 1 FROM public.profiles
               WHERE user_id = _user_id AND role IS NOT NULL AND role::text <> 'customer');

  IF _target_privileged THEN
    _caller_admin :=
      public.has_role(_caller, 'admin')
      AND EXISTS (SELECT 1 FROM public.users_profile
                  WHERE id = _caller AND perfil = 'admin' AND status = 'ativo');
    IF NOT _caller_admin THEN
      RAISE EXCEPTION 'invite_forbidden_staff' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Um link válido por vez: invalida os anteriores ainda não usados.
  UPDATE public.access_invites
     SET expires_at = now()
   WHERE user_id = _user_id AND used_at IS NULL AND expires_at > now();

  _token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.access_invites (user_id, token_hash, created_by, expires_at)
  VALUES (_user_id, encode(digest(_token, 'sha256'), 'hex'), _caller,
          now() + interval '7 days');

  RETURN _token;
END;
$$;

-- Lê o convite para a página de primeiro acesso (sem consumir o token).
CREATE OR REPLACE FUNCTION public.get_access_invite(_token text)
RETURNS TABLE (status text, email text, display_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _inv public.access_invites%ROWTYPE;
BEGIN
  SELECT * INTO _inv FROM public.access_invites
   WHERE token_hash = encode(digest(coalesce(_token, ''), 'sha256'), 'hex');

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::text, NULL::text;
    RETURN;
  END IF;
  IF _inv.used_at IS NOT NULL THEN
    RETURN QUERY SELECT 'used'::text, NULL::text, NULL::text;
    RETURN;
  END IF;
  IF _inv.expires_at <= now() THEN
    RETURN QUERY SELECT 'expired'::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT 'valid'::text, u.email::text,
           coalesce(up.nome, u.raw_user_meta_data->>'display_name')::text
      FROM auth.users u
      LEFT JOIN public.users_profile up ON up.id = u.id
     WHERE u.id = _inv.user_id;
END;
$$;

-- Cliente define a senha. Consome o token (uso único) e devolve o e-mail
-- para o front fazer o login em seguida.
CREATE OR REPLACE FUNCTION public.redeem_access_invite(_token text, _password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _inv public.access_invites%ROWTYPE;
  _email text;
  _banned timestamptz;
BEGIN
  IF _password IS NULL OR length(_password) < 8 OR length(_password) > 72 THEN
    RAISE EXCEPTION 'invite_weak_password' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _inv FROM public.access_invites
   WHERE token_hash = encode(digest(coalesce(_token, ''), 'sha256'), 'hex')
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF _inv.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'invite_used' USING ERRCODE = 'P0001';
  END IF;
  IF _inv.expires_at <= now() THEN
    RAISE EXCEPTION 'invite_expired' USING ERRCODE = 'P0001';
  END IF;

  SELECT email, banned_until INTO _email, _banned
    FROM auth.users WHERE id = _inv.user_id;
  IF _banned IS NOT NULL AND _banned > now() THEN
    RAISE EXCEPTION 'invite_user_blocked' USING ERRCODE = 'P0001';
  END IF;

  UPDATE auth.users
     SET encrypted_password = crypt(_password, gen_salt('bf', 10)),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at = now()
   WHERE id = _inv.user_id;

  UPDATE public.access_invites SET used_at = now() WHERE id = _inv.id;

  RETURN _email;
END;
$$;

REVOKE ALL ON FUNCTION public.create_access_invite(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_access_invite(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_access_invite(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_access_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_access_invite(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_access_invite(text, text) TO anon, authenticated;
