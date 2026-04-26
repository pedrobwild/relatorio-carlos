import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { usePendencias } from "@/hooks/usePendencias";
import { useUserRole } from "@/hooks/useUserRole";

/**
 * Sums badge counts for sections that are NOT shown in the current bottom-nav
 * (i.e. are hidden behind the "Mais" sheet).
 *
 * Returns:
 *   - count: total pending items in hidden sections
 *   - hasUrgent: at least one of the hidden sections has overdue items
 */
export function useHiddenSectionsBadge() {
  const { paths, projectId } = useProjectNavigation();
  const { stats } = usePendencias({ projectId });
  const { isStaff } = useUserRole();
  const { pathname } = useLocation();

  return useMemo(() => {
    // Sections always present in staff bottom nav: Pendências, Cronograma,
    // Atividades, Financeiro. So formalizações + signatures count towards "Mais".
    if (!isStaff) {
      return { count: 0, hasUrgent: false };
    }

    const visibleInBottomNav = new Set<string>([
      paths.pendencias,
      paths.cronograma,
      paths.atividades,
      paths.financeiro,
    ]);

    // If user is on a hidden section page, treat its badge as "currently visible"
    // to avoid pulsing while the user is already there.
    const formalizacoesHidden = !visibleInBottomNav.has(paths.formalizacoes)
      && pathname !== paths.formalizacoes;

    let count = 0;
    if (formalizacoesHidden) count += stats.byType.signature ?? 0;

    // Approval requests (3D + executive) live behind "Mais" too
    const projeto3DHidden = pathname !== paths.projeto3D;
    const executivoHidden = pathname !== paths.executivo;
    if (projeto3DHidden) count += stats.byType.approval_3d ?? 0;
    if (executivoHidden) count += stats.byType.approval_exec ?? 0;

    const hasUrgent = stats.overdueCount > 0 && count > 0;
    return { count, hasUrgent };
  }, [
    isStaff,
    paths.pendencias,
    paths.cronograma,
    paths.atividades,
    paths.financeiro,
    paths.formalizacoes,
    paths.projeto3D,
    paths.executivo,
    pathname,
    stats.byType.signature,
    stats.byType.approval_3d,
    stats.byType.approval_exec,
    stats.overdueCount,
  ]);
}
