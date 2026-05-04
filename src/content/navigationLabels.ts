/**
 * Role-based navigation labels.
 * Staff sees technical terms; clients see friendly, jargon-free labels.
 *
 * Tom de voz: ver `docs/TOM_DE_VOZ.md`.
 */

interface NavLabels {
  sidebar: Record<string, { staff: string; client: string }>;
  breadcrumb: Record<string, { staff: string; client: string }>;
  pages: Record<string, { staff: string; client: string }>;
}

export const navigationLabels: NavLabels = {
  sidebar: {
    dashboard: { staff: "Painel de Obras", client: "Início" },
    jornada: { staff: "Jornada", client: "Minha Jornada" },
    obra: { staff: "Obra", client: "Obra" },
    contrato: { staff: "Contrato", client: "Contrato" },
    projeto3D: { staff: "Projeto 3D", client: "Projeto 3D" },
    executivo: { staff: "Executivo", client: "Plantas e Detalhes" },
    documentos: { staff: "Documentos", client: "Documentos" },
    cronograma: { staff: "Cronograma", client: "Evolução da Obra" },
    compras: { staff: "Compras", client: "Compras" },
    vistorias: { staff: "Vistorias e NC", client: "Vistorias" },
    pendencias: { staff: "Pendências", client: "O que preciso fazer" },
    financeiro: { staff: "Financeiro", client: "Pagamentos e Custos" },
    formalizacoes: { staff: "Formalizações", client: "Aprovações" },
    dadosCliente: { staff: "Dados do Cliente", client: "Dados do Cliente" },
    atividades: { staff: "Atividades", client: "Atividades" },
    orcamento: { staff: "Orçamento", client: "Orçamento" },
    assessor: { staff: "Assessor BWild", client: "Assessor BWild" },
    indicadores: { staff: "Indicadores", client: "Resumo da obra" },
    rdo: { staff: "RDO", client: "Diário da obra" },
    medicoes: { staff: "Medições", client: "Cobranças por etapa" },
    calendario: { staff: "Calendário", client: "Agenda" },
    configuracoes: { staff: "Configurações", client: "Configurações" },
    fornecedores: { staff: "Fornecedores", client: "Fornecedores" },
    relatorios: { staff: "Relatórios", client: "Relatórios" },
    onboarding: { staff: "Primeiros passos", client: "Primeiros passos" },
  },
  breadcrumb: {
    relatorio: { staff: "Relatório", client: "Diário da Obra" },
    contrato: { staff: "Contrato", client: "Contrato" },
    "projeto-3d": { staff: "Projeto 3D", client: "Projeto 3D" },
    executivo: { staff: "Executivo", client: "Plantas e Detalhes" },
    financeiro: { staff: "Financeiro", client: "Pagamentos e Custos" },
    pendencias: { staff: "Pendências", client: "O que preciso fazer" },
    documentos: { staff: "Documentos", client: "Documentos" },
    formalizacoes: { staff: "Formalizações", client: "Aprovações" },
    cronograma: { staff: "Cronograma", client: "Evolução da Obra" },
    compras: { staff: "Compras", client: "Compras" },
    vistorias: { staff: "Vistorias e NC", client: "Vistorias" },
    jornada: { staff: "Jornada", client: "Minha Jornada" },
    atividades: { staff: "Atividades", client: "Atividades" },
    indicadores: { staff: "Indicadores", client: "Resumo" },
    rdo: { staff: "RDO", client: "Diário" },
    medicoes: { staff: "Medições", client: "Cobranças" },
    configuracoes: { staff: "Configurações", client: "Configurações" },
    onboarding: { staff: "Primeiros passos", client: "Primeiros passos" },
  },
  pages: {
    painelObras: { staff: "Painel de Obras", client: "Minhas obras" },
    compras: { staff: "Compras", client: "Compras da obra" },
    cronograma: { staff: "Cronograma", client: "Evolução da obra" },
    calendario: { staff: "Calendário", client: "Agenda da obra" },
    rdo: { staff: "RDO", client: "Diário da obra" },
    medicoes: { staff: "Medições", client: "Cobranças por etapa" },
    indicadores: { staff: "Indicadores", client: "Resumo da obra" },
    configuracoes: { staff: "Configurações", client: "Configurações" },
    clienteDashboard: { staff: "Dashboard do Cliente", client: "Início" },
    onboarding: { staff: "Primeiros passos", client: "Primeiros passos" },
  },
} as const;

/** Helper to pick label by role */
export function getNavLabel(
  section: keyof NavLabels,
  key: string,
  isStaff: boolean,
): string {
  const entry = navigationLabels[section][key];
  if (!entry) return key;
  return isStaff ? entry.staff : entry.client;
}
