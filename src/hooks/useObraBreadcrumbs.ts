import { useMemo } from "react";
import { useProject } from "@/contexts/ProjectContext";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { useUserRole } from "@/hooks/useUserRole";
import { navigationLabels, getNavLabel } from "@/constants/navigationLabels";
import type { BreadcrumbItem } from "@/components/layout/PageHeader";

export type ObraBreadcrumbSection = keyof typeof navigationLabels.breadcrumb;

/**
 * useObraBreadcrumbs — canonical breadcrumb builder for `/obra/:id/*` pages.
 *
 * Builds a 3-level trail using role-aware labels:
 *   [Minhas Obras / Painel de Obras] > [Project Name] > [Current Section]
 *
 * Pages should call this with the section key (matches navigationLabels.breadcrumb)
 * and pass the result to <PageHeader breadcrumbs={...} />.
 */
export function useObraBreadcrumbs(
  currentSection: ObraBreadcrumbSection,
): BreadcrumbItem[] {
  const { project } = useProject();
  const { paths } = useProjectNavigation();
  const { isStaff } = useUserRole();

  return useMemo<BreadcrumbItem[]>(() => {
    const rootLabel = isStaff ? "Painel de Obras" : "Minhas Obras";
    const rootHref = isStaff ? "/gestao/painel-obras" : "/minhas-obras";
    const projectLabel = project?.name ?? (isStaff ? "Obra" : "Minha Obra");
    const sectionLabel = getNavLabel("breadcrumb", currentSection, isStaff);

    return [
      { label: rootLabel, href: rootHref },
      { label: projectLabel, href: paths.relatorio },
      { label: sectionLabel },
    ];
  }, [isStaff, project?.name, paths.relatorio, currentSection]);
}
