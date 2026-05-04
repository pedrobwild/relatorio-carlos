/**
 * Short labels for each project section, used by the mobile obra header to
 * show a "› {section}" trail next to the project name.
 *
 * Keys are the path segment immediately after `/obra/:projectId/` (or `hub`
 * when the route is the project root).
 */
export const SECTION_LABELS: Record<string, string> = {
  hub: "Visão geral",
  relatorio: "Painel",
  jornada: "Jornada",
  painel: "Painel",
  cronograma: "Cronograma",
  compras: "Compras",
  documentos: "Documentos",
  contrato: "Contrato",
  pendencias: "Pendências",
  financeiro: "Financeiro",
  formalizacoes: "Formalizações",
  vistorias: "Vistorias",
  "nao-conformidades": "Não Conformidades",
  "dados-cliente": "Dados do cliente",
  atividades: "Atividades",
  orcamento: "Orçamento",
  "projeto-3d": "Projeto 3D",
  executivo: "Executivo",
  assessor: "Assessor",
};

/**
 * Resolve the section label from a pathname like `/obra/123/cronograma`.
 * Returns `null` when no section is recognized (caller decides what to render).
 */
export function getSectionLabel(pathname: string): string | null {
  const match = pathname.match(/^\/obra\/[^/]+\/?(.*)?$/);
  if (!match) return null;
  const rest = match[1] ?? "";
  if (!rest) return SECTION_LABELS.relatorio ?? null;
  const firstSegment = rest.split("/")[0];
  return SECTION_LABELS[firstSegment] ?? null;
}
