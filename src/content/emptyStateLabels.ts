/**
 * Copy de estado vazio.
 *
 * Tom: humano, curto, sem juridiquês. Quando "vazio" é positivo
 * (nada pendente), celebre discretamente. Quando é o primeiro uso,
 * sugira a próxima ação.
 *
 * Ver `docs/TOM_DE_VOZ.md`.
 */

export interface EmptyStateCopy {
  title: string;
  description: string;
  /** Texto opcional para botão de ação primária. */
  cta?: string;
}

export const emptyStateLabels = {
  obras: {
    title: "Nenhuma obra cadastrada ainda",
    description: "Comece pela primeira obra para acompanhar cronograma, compras e medições.",
    cta: "Cadastrar primeira obra",
  },
  obrasCliente: {
    title: "Você ainda não tem obras vinculadas",
    description: "Quando a equipe BWild liberar o acesso, sua obra aparece aqui.",
  },
  compras: {
    title: "Nenhuma compra pendente — tudo em dia",
    description: "Quando algo precisar de aprovação, pedido ou recebimento, aparece aqui.",
  },
  comprasFiltradas: {
    title: "Nada bate com esse filtro",
    description: "Tente limpar os filtros ou alterar o período.",
    cta: "Limpar filtros",
  },
  cronograma: {
    title: "Cronograma vazio",
    description: "Adicione as primeiras atividades para visualizar a Curva S e o caminho crítico.",
    cta: "Adicionar atividade",
  },
  calendario: {
    title: "Sem eventos no período",
    description: "Marque entregas, vistorias e reuniões para acompanhar a agenda da obra.",
    cta: "Criar evento",
  },
  rdo: {
    title: "Nenhum RDO esta semana",
    description: "Lance o diário de hoje para registrar mão de obra, clima e atividades.",
    cta: "Lançar RDO de hoje",
  },
  medicoes: {
    title: "Nenhuma medição registrada",
    description: "A primeira medição abre a cobrança proporcional ao executado.",
    cta: "Registrar medição",
  },
  indicadores: {
    title: "Sem dados para gerar indicadores",
    description: "Os números aparecem assim que houver cronograma e medições registradas.",
  },
  documentos: {
    title: "Nenhum documento ainda",
    description: "Envie contrato, projeto e plantas para concentrar tudo num lugar só.",
    cta: "Enviar documento",
  },
  formalizacoes: {
    title: "Nenhuma aprovação pendente",
    description: "Decisões importantes que precisam de ciência ficam listadas aqui.",
  },
  pendencias: {
    title: "Nenhuma pendência — tudo em dia",
    description: "Quando algo precisar da sua atenção, aparece aqui.",
  },
  financeiro: {
    title: "Nenhum pagamento registrado",
    description: "Parcelas e boletos aparecem aqui assim que a equipe lançar.",
  },
  vistorias: {
    title: "Nenhuma vistoria registrada",
    description: "Inspeções e não-conformidades ficam listadas aqui.",
    cta: "Registrar vistoria",
  },
  fornecedores: {
    title: "Nenhum fornecedor cadastrado",
    description: "Cadastre fornecedores recorrentes para agilizar pedidos de compra.",
    cta: "Cadastrar fornecedor",
  },
  busca: {
    title: "Nada encontrado",
    description: "Tente outros termos ou ajuste os filtros.",
  },
  configuracoes: {
    title: "Nada configurado ainda",
    description: "Defina permissões, integrações e preferências da organização.",
  },
} as const satisfies Record<string, EmptyStateCopy>;

export type EmptyStateKey = keyof typeof emptyStateLabels;
