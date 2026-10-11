/**
 * /gestao → tela inicial da gestão.
 *
 * Com a flag `novoPainelObras` ligada, quem está no menu simples (gestor de
 * obra) cai na tela Obras nova (Fase 5). Os demais continuam no Painel de
 * Obras de sempre.
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
  const target = isEnabled("novoPainelObras") && isSimple ? "/gestao/obras" : "/gestao/painel-obras";
  return <Navigate to={target} replace />;
}
