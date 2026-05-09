import { useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useProjectOptional } from "@/contexts/ProjectContext";
import { useUserRole } from "@/hooks/useUserRole";
import { getNavLabel } from "@/content/navigationLabels";
import type { BreadcrumbItem } from "@/components/layout/PageHeader";

/**
 * Builds canonical breadcrumbs for project-scoped pages (`/obra/:projectId/*`)
 * and gestao pages (`/gestao/*`). Falls back to an empty list outside those
 * scopes so callers can spread the result without conditionals.
 *
 * Order: root crumb → project crumb (when in project scope) → current section.
 * The current section is derived from the URL path segment using
 * `navigationLabels.breadcrumb`. Unknown segments are skipped so we never
 * render a raw URL slug.
 */
export function useObraBreadcrumbs(): BreadcrumbItem[] {
  const location = useLocation();
  const { projectId: paramProjectId } = useParams<{ projectId: string }>();
  const projectCtx = useProjectOptional();
  const project = projectCtx?.project ?? null;
  const { isStaff } = useUserRole();

  return useMemo(() => {
    const segments = location.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return [];

    const crumbs: BreadcrumbItem[] = [];

    // Gestão portfolio
    if (segments[0] === "gestao") {
      crumbs.push({ label: "Gestão", href: "/gestao/painel-obras" });
      const sub = segments[1];
      if (sub && sub !== "painel-obras") {
        const label = getNavLabel("breadcrumb", sub, isStaff);
        crumbs.push({ label });
      }
      return crumbs;
    }

    // Project scope
    if (segments[0] === "obra" && paramProjectId) {
      crumbs.push({
        label: isStaff ? "Painel de Obras" : "Minhas obras",
        href: isStaff ? "/gestao/painel-obras" : "/minhas-obras",
      });
      const projectName =
        project?.name ?? (project?.unit_name ? "" : "Obra");
      crumbs.push({
        label: project?.unit_name
          ? `${projectName} – ${project.unit_name}`
          : projectName,
        href: `/obra/${paramProjectId}`,
      });

      // Current section (e.g. /obra/:id/cronograma → "Cronograma")
      const sub = segments[2];
      if (sub) {
        const label = getNavLabel("breadcrumb", sub, isStaff);
        if (label && label !== sub) {
          crumbs.push({ label });
        }
      }
      return crumbs;
    }

    return crumbs;
  }, [location.pathname, paramProjectId, project, isStaff]);
}
