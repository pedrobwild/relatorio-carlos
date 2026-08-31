-- Mata a ORIGEM da divergencia de papeis que travou o cronograma em 31/08.
--
-- Existem TRES stores de papel neste banco, e telas diferentes leem stores
-- diferentes:
--
--   public.user_roles      -> lido pelo frontend (useUserRole), por is_staff()
--                             e por has_project_access(); e a fonte da UI.
--   public.users_profile   -> lido por is_admin_v2(), has_obra_access() e
--     .perfil/.status         get_effective_role(); e a fonte dos gates legados.
--   public.profiles.role   -> lido por policies de journey_stage_date_log,
--                             journey_meeting_availability e project_templates.
--
-- src/hooks/useUsers.ts:69 escrevia SO o primeiro. Toda promocao feita pela tela
-- /admin nascia divergente: a pessoa virava admin na UI e continuava com o
-- perfil antigo nos gates do banco. Foi assim que bianca@bwild.com.br ficou
-- [admin] em user_roles e 'engineer' em users_profile, e nao conseguiu salvar
-- nenhum cronograma depois que a migracao 20260825140418 passou a consultar o
-- store legado.
--
-- Alem disso, aquela escrita era um
--   UPDATE user_roles SET role = $novo WHERE user_id = $id
-- sem filtrar a linha. Para quem tem dois papeis (hoje gabriela@bwild.com.br
-- [admin,suprimentos] e lucas.serra@bwild.com.br [admin,cs]) as DUAS linhas
-- viravam o mesmo valor e violavam UNIQUE (user_id, role) — ou seja, editar o
-- papel dessas pessoas ja falhava.
--
-- Esta RPC escreve os tres stores numa unica transacao. Ou os tres mudam, ou
-- nenhum muda.
--
-- NOTA sobre multi-papel: a tela /admin oferece UM seletor de papel, entao
-- definir um papel aqui substitui os demais. E o que a UI sempre quis dizer;
-- antes ela so nao conseguia executar. `status` NAO e tocado de proposito:
-- reativar alguem desligado e uma decisao de gestao, nao efeito colateral de
-- trocar papel.
CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_user_id uuid, p_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Gate ESTRITO, de proposito: is_admin_v2() exige users_profile.perfil='admin'
  -- E status='ativo'. Nao aceitamos aqui o admin vindo so de user_roles.
  --
  -- Motivo: conceder papel e a operacao mais sensivel do sistema, e ha usuarios
  -- divergentes cujo user_roles diz 'admin' enquanto o perfil diz 'customer'
  -- (victorya@bwild.com.br) ou que estao desligados (status='inativo'). Com um
  -- gate frouxo, qualquer um deles se auto-promoveria por aqui — o que eu
  -- confirmei na pratica ao testar a primeira versao desta funcao.
  IF auth.uid() IS NULL OR NOT public.is_admin_v2() THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar papéis de usuário';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  -- 1) Fonte da UI.
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, p_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 2) Fonte dos gates do banco.
  UPDATE public.users_profile SET perfil = p_role WHERE id = p_user_id;

  -- 3) Fonte das policies de jornada. O CHECK de profiles_role_check aceita
  --    todos os valores de app_role, entao o cast direto e seguro.
  UPDATE public.profiles SET role = p_role::text WHERE user_id = p_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(uuid, app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, app_role) TO service_role;
