-- =====================================================================
-- Gestor de obra (papel `gestor`, sem ser admin) — o que faltava para o
-- papel funcionar de verdade
-- =====================================================================
-- Até aqui toda a equipe era admin, então duas lacunas nunca apareceram:
--
--  1. users_profile / profiles só deixavam ver o PRÓPRIO perfil (ou tudo,
--     se admin). Para um gestor, os nomes dos colegas somem: "quem faz" na
--     Semana e no Hoje, responsável e engenheiro na tela Obras.
--     Agora a equipe enxerga os perfis da equipe (nunca os de clientes).
--
--  2. Quem não é admin só acessa a obra se estiver em project_members, e
--     obra nova só ganha os admins como membros. Um gestor escolhido como
--     responsável de uma obra não a enxergava. Agora, ao definir o
--     responsável, ele vira membro da obra.
--
-- Idempotente. Não remove nenhum acesso existente.
-- =====================================================================

-- 1) Equipe vê os perfis da equipe ------------------------------------
DROP POLICY IF EXISTS staff_view_staff_profiles ON public.users_profile;
CREATE POLICY staff_view_staff_profiles ON public.users_profile
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) AND public.is_staff(id));

DROP POLICY IF EXISTS "Staff can view staff profiles" ON public.profiles;
CREATE POLICY "Staff can view staff profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) AND public.is_staff(user_id));

-- 2) Responsável da obra passa a ser membro dela ----------------------
CREATE OR REPLACE FUNCTION public.ensure_responsavel_is_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- O EXISTS evita que um id sem usuário correspondente faça a gravação da
  -- obra falhar por causa da FK de project_members.
  IF NEW.painel_responsavel_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.painel_responsavel_id IS DISTINCT FROM OLD.painel_responsavel_id)
     AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = NEW.painel_responsavel_id) THEN
    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES (NEW.id, NEW.painel_responsavel_id, 'engineer')
    ON CONFLICT (project_id, user_id) DO NOTHING;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_responsavel_is_member() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_projects_responsavel_member ON public.projects;
CREATE TRIGGER trg_projects_responsavel_member
  AFTER INSERT OR UPDATE OF painel_responsavel_id ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.ensure_responsavel_is_member();

-- Quem já é responsável e ainda não é membro (cadastros anteriores).
INSERT INTO public.project_members (project_id, user_id, role)
SELECT p.id, p.painel_responsavel_id, 'engineer'
FROM public.projects p
WHERE p.painel_responsavel_id IS NOT NULL
  AND p.deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.painel_responsavel_id)
ON CONFLICT (project_id, user_id) DO NOTHING;
