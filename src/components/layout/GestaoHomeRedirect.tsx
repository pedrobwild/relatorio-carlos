/**
 * /gestao → tela inicial da gestão.
 *
 * Com a flag `telaOQueFazer` (ligada por padrão), todo mundo cai em
 * "O que fazer": as pendências das suas obras, da mais grave para a mais leve.
 * Desligada, vale a regra de antes: com `novoPainelObras`, quem está no menu
 * simples cai na tela Obras nova; os demais, no Painel de Obras.
 */
import { Navigate } from "react-router-dom";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useMenuMode } from "@/hooks/useMenuMode";
import { useUserRole } from "@/hooks/useUserRole";

export function GestaoHomeRedirect() {
  const { isEnabled, isLoading } = useFeatureFlags();
  const { loading: rolesLoading } = useUserRole();
  const { isSimple } = useMenuMode();
  if (isLoading || rolesLoading) return null;
  const target = isEnabled("telaOQueFazer")
    ? "/gestao/o-que-fazer"
    : isEnabled("novoPainelObras") && isSimple
      ? "/gestao/obras"
      : "/gestao/painel-obras";
  return <Navigate to={target} replace />;
}
