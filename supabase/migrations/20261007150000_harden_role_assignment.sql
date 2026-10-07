-- Endurece a atribuição de papéis (escalada de privilégio).
--
-- POR QUE ISTO EXISTE
-- 1) Os triggers de criação de usuário em auth.users liam o papel de
--    `raw_user_meta_data`, que é controlado pelo próprio cliente: qualquer
--    pessoa podia chamar /auth/v1/signup com `data: { role: 'admin' }` e
--    nascer admin em user_roles, users_profile.perfil e profiles.role — e
--    passar por todas as policies de staff/admin do portal. O cadastro
--    público está ativo (há contas criadas por ele).
-- 2) A policy "Users can update their own profile" de public.profiles não
--    tinha WITH CHECK nem restrição de coluna: qualquer usuário logado podia
--    trocar o próprio `role` (lido por user_is_admin()), o próprio
--    `customer_org_id` (lido por user_belongs_to_org() em formalizações,
--    pendências e anexos) e o próprio `email` (lido por
--    user_must_sign_formalization()).
--
-- O QUE MUDA
-- * O papel inicial vem APENAS de `raw_app_meta_data`, que só o service role
--   (API admin) consegue escrever. Sem ele, todo usuário nasce `customer`.
--   O mesmo vale para `customer_org_id` (sem ele, org nova e isolada).
-- * Em public.profiles, usuário comum só altera o próprio `display_name`.
--   Mudança de papel continua pelos caminhos legítimos: admin_set_user_role
--   (SECURITY DEFINER) e edge functions com service role.
--
-- Contas existentes não são alteradas.

-- ----------------------------------------------------------------------------
-- Papel inicial: só de raw_app_meta_data, validado contra o enum
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.initial_role_from_app_metadata(_app_meta jsonb)
RETURNS public.app_role
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  -- Valor desconhecido vira 'customer' em vez de abortar o cadastro.
  SELECT COALESCE(
    (SELECT e.enumlabel::public.app_role
       FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typname = 'app_role'
        AND e.enumlabel = _app_meta->>'role'),
    'customer'::public.app_role
  );
$$;

REVOKE ALL ON FUNCTION public.initial_role_from_app_metadata(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- NUNCA ler o papel de raw_user_meta_data: o cliente controla esse campo.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, public.initial_role_from_app_metadata(NEW.raw_app_meta_data));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_profile_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users_profile (id, nome, email, perfil, status)
  VALUES (
    NEW.id,
    -- Nome de exibição é só apresentação: pode vir do cliente.
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.email,
    public.initial_role_from_app_metadata(NEW.raw_app_meta_data),
    'ativo'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  -- Org também não pode vir do cliente: com ela se entra na org de outro.
  BEGIN
    v_org := (NEW.raw_app_meta_data->>'customer_org_id')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_org := NULL;
  END;

  INSERT INTO public.profiles (user_id, customer_org_id, role, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(v_org, gen_random_uuid()),
    public.initial_role_from_app_metadata(NEW.raw_app_meta_data)::text,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_profile_v2() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_profile() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- public.profiles: usuário comum só altera o próprio display_name
-- ----------------------------------------------------------------------------
-- Ninguém no front escreve em profiles; quem escreve usa service role
-- (update-user) ou SECURITY DEFINER (admin_set_user_role), que não dependem
-- destes GRANTs.
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (display_name, updated_at) ON public.profiles TO authenticated;

-- Defesa em profundidade: mesmo que um GRANT futuro reabra colunas, a
-- policy de auto-edição não deixa mudar papel, org nem e-mail.
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND role = (SELECT p.role FROM public.profiles p WHERE p.user_id = auth.uid())
    AND customer_org_id = (SELECT p.customer_org_id FROM public.profiles p WHERE p.user_id = auth.uid())
    AND email IS NOT DISTINCT FROM (SELECT p.email FROM public.profiles p WHERE p.user_id = auth.uid())
  );
