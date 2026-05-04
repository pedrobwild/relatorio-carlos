import { useParams } from "react-router-dom";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { usePendencias } from "@/hooks/usePendencias";

/**
 * Sums pending-item badges for sections that are NOT currently visible in the
 * mobile bottom-nav bar. Result is rendered in "Mais" so users see at-a-glance
 * that hidden sections need attention.
 *
 * `visibleNavTos` is the array of `to` paths shown in the main bar; sections
 * whose path is in this array are considered visible and excluded from the sum.
 */
export function useHiddenSectionsBadge(visibleNavTos: string[]): number {
  const { projectId } = useParams<{ projectId: string }>();
  const { paths } = useProjectNavigation();
  const { stats } = usePendencias({ projectId });

  let total = 0;

  // formalizacoes (signature pendencies)
  if (!visibleNavTos.includes(paths.formalizacoes)) {
    total += stats.byType.signature ?? 0;
  }
  // financeiro (invoice pendencies)
  if (!visibleNavTos.includes(paths.financeiro)) {
    total += stats.byType.invoice ?? 0;
  }
  // pendencias (overdue/urgent — only if the dedicated tab isn't shown)
  if (!visibleNavTos.includes(paths.pendencias)) {
    total += stats.overdueCount + stats.urgentCount;
  }

  return total;
}
