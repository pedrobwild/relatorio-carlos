/**
 * Glossário de termos de obra em linguagem leiga.
 *
 * Termos técnicos consolidados (RDO, ART, BDI, etc) NÃO são substituídos —
 * são explicados via `<Glossary>` na primeira ocorrência por tela.
 *
 * Ver `docs/TOM_DE_VOZ.md`.
 */

export interface GlossaryEntry {
  /** Como o termo aparece em texto. */
  term: string;
  /** Explicação em linguagem leiga, 1-2 frases. */
  definition: string;
  /** Categoria para organização do glossário (UI futura). */
  category:
    | 'cronograma'
    | 'financeiro'
    | 'compras'
    | 'execucao'
    | 'qualidade'
    | 'documentacao'
    | 'projeto';
}

export const glossario = {
  medicao: {
    term: 'Medição',
    definition:
      'Cobrança parcial proporcional ao que foi executado no período. Em vez de pagar tudo no fim, você paga em partes conforme a obra avança.',
    category: 'financeiro',
  },
  rdo: {
    term: 'RDO',
    definition:
      'Relatório Diário de Obra. Registro do que aconteceu no dia: equipe presente, atividades, clima, ocorrências e fotos.',
    category: 'execucao',
  },
  diarioDeObra: {
    term: 'Diário de obra',
    definition:
      'Mesmo que RDO. O caderno (hoje digital) onde a equipe registra tudo que acontece no canteiro a cada dia.',
    category: 'execucao',
  },
  leadTime: {
    term: 'Lead time',
    definition:
      'Tempo entre pedir um material ao fornecedor e ele chegar na obra. Cerâmica importada, por exemplo, tem lead time alto.',
    category: 'compras',
  },
  retencao: {
    term: 'Retenção',
    definition:
      'Parte do pagamento (geralmente 5%) segurada até o fim da obra como garantia de qualidade. Volta para o contratado depois da entrega aprovada.',
    category: 'financeiro',
  },
  aditivo: {
    term: 'Aditivo',
    definition:
      'Mudança formal no contrato durante a obra: prazo, escopo ou valor. Cada aditivo precisa de assinatura das duas partes.',
    category: 'documentacao',
  },
  punchList: {
    term: 'Punch list',
    definition:
      'Lista de pequenos ajustes pendentes antes da entrega final. Ex.: "ajustar fechadura", "retocar tinta no rodapé".',
    category: 'qualidade',
  },
  art: {
    term: 'ART',
    definition:
      'Anotação de Responsabilidade Técnica. Documento do CREA que registra qual engenheiro responde tecnicamente pela obra.',
    category: 'documentacao',
  },
  rrt: {
    term: 'RRT',
    definition:
      'Registro de Responsabilidade Técnica. Equivalente da ART para arquitetos, emitido pelo CAU.',
    category: 'documentacao',
  },
  bdi: {
    term: 'BDI',
    definition:
      'Benefícios e Despesas Indiretas. Percentual somado ao custo direto da obra para cobrir impostos, administração e lucro.',
    category: 'financeiro',
  },
  cronogramaFisicoFinanceiro: {
    term: 'Cronograma físico-financeiro',
    definition:
      'Linha do tempo que cruza o que será executado (físico) com quanto custa (financeiro) em cada etapa.',
    category: 'cronograma',
  },
  curvaS: {
    term: 'Curva S',
    definition:
      'Gráfico que mostra o avanço acumulado da obra ao longo do tempo. Tem formato de "S" porque a obra começa e termina devagar e acelera no meio.',
    category: 'cronograma',
  },
  caminhoCritico: {
    term: 'Caminho crítico',
    definition:
      'Sequência de atividades que, se atrasarem, atrasam a obra inteira. Atividades fora do caminho crítico têm folga.',
    category: 'cronograma',
  },
  marcoZero: {
    term: 'Marco zero',
    definition:
      'Data oficial de início dos trabalhos, normalmente vinculada à liberação do alvará e mobilização da equipe.',
    category: 'cronograma',
  },
  vistoria: {
    term: 'Vistoria',
    definition:
      'Inspeção formal numa etapa da obra para conferir se o que foi executado bate com o projeto e a norma.',
    category: 'qualidade',
  },
  nc: {
    term: 'NC',
    definition:
      'Não Conformidade. Algo executado fora do padrão (projeto, norma ou contrato). Cada NC tem prazo e responsável para correção.',
    category: 'qualidade',
  },
  habiteSe: {
    term: 'Habite-se',
    definition:
      'Documento da prefeitura que libera o uso do imóvel após a obra. Sem ele, a obra ainda não está "oficialmente" entregue.',
    category: 'documentacao',
  },
  alvara: {
    term: 'Alvará',
    definition:
      'Autorização da prefeitura para iniciar a obra. Sem alvará, qualquer trabalho fica irregular.',
    category: 'documentacao',
  },
  formalizacao: {
    term: 'Formalização',
    definition:
      'Decisão importante que precisa de ciência ou aprovação registrada — escolha de acabamento, mudança de escopo, aprovação de cor.',
    category: 'documentacao',
  },
  pendencia: {
    term: 'Pendência',
    definition:
      'Algo aguardando uma ação sua: aprovação, escolha, envio de documento, resposta a uma dúvida da equipe.',
    category: 'execucao',
  },
  composicao: {
    term: 'Composição',
    definition:
      'Detalhamento de um serviço em todos os seus insumos: materiais, mão de obra, horas-equipamento, com os respectivos custos.',
    category: 'financeiro',
  },
  encargosSociais: {
    term: 'Encargos sociais',
    definition:
      'Custos trabalhistas somados ao salário direto: INSS, FGTS, férias, 13º. Costumam representar 80–120% do salário base.',
    category: 'financeiro',
  },
  insumo: {
    term: 'Insumo',
    definition:
      'Cada item usado na obra: cimento, areia, hora de pedreiro, hora de betoneira. A composição é a soma dos insumos.',
    category: 'compras',
  },
  contramedicao: {
    term: 'Contramedição',
    definition:
      'Conferência da medição feita pela contratante. Compara o que o executor mediu com o que ela considera executado de fato.',
    category: 'financeiro',
  },
  asBuilt: {
    term: 'As built',
    definition:
      'Versão final dos projetos refletindo exatamente como ficou a obra (com as alterações de execução). Importante pra manutenção futura.',
    category: 'projeto',
  },
  projetoExecutivo: {
    term: 'Projeto executivo',
    definition:
      'Conjunto de plantas e detalhes que mostram, com precisão milimétrica, como a obra será construída — base para o canteiro.',
    category: 'projeto',
  },
  projetoBasico: {
    term: 'Projeto básico',
    definition:
      'Versão preliminar do projeto, suficiente para orçar e contratar, mas que ainda exige detalhamento executivo para construir.',
    category: 'projeto',
  },
  cronogramaFisico: {
    term: 'Cronograma físico',
    definition:
      'Linha do tempo só das atividades de obra (sem dinheiro). Mostra quando cada etapa começa e termina.',
    category: 'cronograma',
  },
  fornecedor: {
    term: 'Fornecedor',
    definition:
      'Empresa que entrega material, equipamento ou serviço para a obra. Cada compra tem um fornecedor associado.',
    category: 'compras',
  },
  pedidoDeCompra: {
    term: 'Pedido de compra',
    definition:
      'Documento formal pedindo material ou serviço a um fornecedor — com quantidade, prazo e valor acordados.',
    category: 'compras',
  },
  recebimento: {
    term: 'Recebimento',
    definition:
      'Conferência e aceite do material entregue na obra. Recebimento parcial é comum quando o pedido vem em lotes.',
    category: 'compras',
  },
  mobilizacao: {
    term: 'Mobilização',
    definition:
      'Etapa inicial: instalar canteiro, água, energia, tapumes, container de equipe. Antes da obra "real" começar.',
    category: 'execucao',
  },
  desmobilizacao: {
    term: 'Desmobilização',
    definition:
      'Encerramento do canteiro: retirada de equipamentos, limpeza final, devolução de chaves de container.',
    category: 'execucao',
  },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof glossario;

/** Busca uma entrada do glossário por chave. Retorna `undefined` se não existir. */
export function getGlossaryEntry(key: GlossaryKey): GlossaryEntry | undefined {
  return glossario[key];
}
