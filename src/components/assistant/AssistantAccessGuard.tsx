import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isAssistantAllowed } from "@/lib/assistantAccess";

/**
 * Restringe as rotas do Assistente de IA a colaboradores BWild
 * (`@bwild.com.br`). Usado por dentro de StaffRoute/AdminRoute, então a
 * autenticação já está resolvida; ainda assim não redireciona durante o
 * loading para evitar flicker.
 */
export function AssistantAccessGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!isAssistantAllowed(user?.email)) {
    return <Navigate to="/gestao" replace />;
  }
  return <>{children}</>;
}
