import { useMemo, useContext } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { navigationLabels, getNavLabel } from "@/constants/navigationLabels";
import type { BreadcrumbItem } from "@/components/layout/PageHeader";
import { ProjectContext } from "@/contexts/ProjectContext";

/**
 * Map of /gestao/* sub-routes to user-facing labels.
 * Keep aligned with src/components/layout/GestaoSidebar.tsx.
 */
const GESTAO_LABELS: Record<string, string> = {
  "painel-obras": "Painel de Obras",
  "alertas-cronograma": "Alertas de Cronograma",
  "nova-obra": "Nova Obra",
  lixeira: "Lixeira",
  obra: "Obra",
  arquivos: "Arquivos",
  "calendario-compras": "Calendário de Compras",
  "calendario-obras": "Calendário de Obras",
  estoque: "Estoque",
  fornecedores: "Fornecedores",
  orcamentos: "Orçamentos",
  "nao-conformidades": "Não Conformidades",
  atividades: "Atividades",
  assistente: "Assistente IA",
  consultas: "Consultas",
  logs: "Logs",
  cs: "CS",
  operacional: "Operacional",
  analytics: "Analytics",
  admin: "Configurações",
  wizard: "Editar",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}/i;

/**
 * Build the canonical breadcrumb trail for the current page.
 *
 * - For /obra/:projectId/* routes: returns
 *     [Painel de Obras / Minhas Obras, Project name, Section]
 * - For /gestao/* routes: returns
 *     [Gestão, ...sub-segments]
 * - For other routes: returns []
 *
 * Section labels come from `navigationLabels.breadcrumb` (role-aware).
 *
 * Safe to call both inside and outside `ProjectProvider`. When no project
 * context is available, the project crumb falls back to "Obra".
 *
 * @example
 *   const breadcrumbs = useObraBreadcrumbs();
 *   <PageHeader title="Compras" breadcrumbs={breadcrumbs} />
 */
export function useObraBreadcrumbs(
  /** Optional override — when omitted, derived from the URL. */
  currentSection?: keyof typeof navigationLabels.breadcrumb,
): BreadcrumbItem[] {
  const location = useLocation();
  const params = useParams<{ projectId?: string }>();
  const { isStaff } = useUserRole();
  // Read directly from context — does NOT throw when no provider is present.
  const projectCtx = useContext(ProjectContext);
  const projectName = projectCtx?.project?.name;

  return useMemo(() => {
    const path = location.pathname;

    // /obra/:projectId/* routes
    if (path.startsWith("/obra/")) {
      const segments = path.split("/").filter(Boolean); // ["obra", ":projectId", "section?", ...]
      const projectId = params.projectId ?? segments[1];
      const subSegment = currentSection ?? segments[2];

      const trail: BreadcrumbItem[] = [
        {
          label: isStaff ? "Painel de Obras" : "Minhas Obras",
          href: isStaff ? "/gestao/painel-obras" : "/minhas-obras",
        },
        {
          label: projectName ?? "Obra",
          href: projectId ? `/obra/${projectId}` : undefined,
        },
      ];

      if (subSegment) {
        trail.push({ label: getNavLabel("breadcrumb", subSegment, isStaff) });
      }

      return trail;
    }

    // /gestao/* routes
    if (path.startsWith("/gestao")) {
      const segments = path.split("/").filter(Boolean); // ["gestao", "section", ...rest]
      const trail: BreadcrumbItem[] = [
        { label: "Gestão", href: "/gestao/painel-obras" },
      ];

      for (let i = 1; i < segments.length; i++) {
        const seg = segments[i];
        if (UUID_RE.test(seg)) continue; // skip ids
        const label = GESTAO_LABELS[seg] ?? seg;
        const isLast = i === segments.length - 1;
        trail.push(
          isLast
            ? { label }
            : { label, href: "/" + segments.slice(0, i + 1).join("/") },
        );
      }

      return trail;
    }

    return [];
  }, [
    location.pathname,
    params.projectId,
    currentSection,
    projectName,
    isStaff,
  ]);
}
