/**
 * Maps a project-scoped sub-route to a short, human-readable label used in the
 * mobile header sub-line ("Obra X › Painel"). Add new entries here when adding
 * new routes — keep labels short (1–2 words, no abbreviations).
 */
export const SECTION_LABELS: Record<string, string> = {
  hub: 'Visão geral',
  relatorio: 'Painel',
  jornada: 'Jornada',
  cronograma: 'Cronograma',
  compras: 'Compras',
  documentos: 'Documentos',
  contrato: 'Contrato',
  pendencias: 'Pendências',
  financeiro: 'Financeiro',
  formalizacoes: 'Formalizações',
  vistorias: 'Vistorias',
  'projeto-3d': 'Projeto 3D',
  executivo: 'Executivo',
  'dados-cliente': 'Dados do cliente',
  atividades: 'Atividades',
  'nao-conformidades': 'Não conformidades',
  orcamento: 'Orçamento',
};

/**
 * Resolves the section label from a pathname like `/obra/abc/financeiro`.
 * Returns null if the path is not project-scoped or the section is unknown.
 */
export function resolveSectionLabel(pathname: string): string | null {
  const match = pathname.match(/^\/obra\/[^/]+\/([^/]+)/);
  if (!match) return null;
  return SECTION_LABELS[match[1]] ?? null;
}

/**
 * Returns true when the current path is the obra hub/landing — back button
 * should not be shown there.
 */
export function isObraLandingRoute(pathname: string): boolean {
  return /^\/obra\/[^/]+\/?(relatorio|hub)?$/.test(pathname);
}
