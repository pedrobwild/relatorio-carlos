import type { ReactNode } from "react";

/**
 * Tema claro é o único tema suportado no Portal BWild.
 * Este wrapper é mantido apenas para compatibilidade com a árvore atual de
 * componentes (consumidores ainda importam `<ThemeProvider>`). Não há
 * lógica de troca de tema, hidratação ou persistência — toda essa
 * infraestrutura foi removida intencionalmente.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
