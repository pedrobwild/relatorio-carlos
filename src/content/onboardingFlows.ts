/**
 * Fluxos de onboarding contextuais por papel + fase da obra.
 *
 * 6 variantes funcionais (3 papéis × 3 fases, com merges sensatos).
 * Tom: ver `docs/TOM_DE_VOZ.md`.
 */

export type OnboardingRole = 'cliente' | 'equipe' | 'admin';
export type ObraStatus = 'planejamento' | 'execucao' | 'entrega';

export interface OnboardingStep {
  /** Chave estável usada para persistência. */
  id: string;
  title: string;
  description: string;
  /** Rota sugerida para o CTA. */
  href?: string;
  /** Texto do CTA. Default: "Abrir". */
  ctaLabel?: string;
}

export type OnboardingFlowKey = `${OnboardingRole}:${ObraStatus}`;

export const onboardingFlows: Record<OnboardingFlowKey, OnboardingStep[]> = {
  // ──────────────── Cliente ────────────────
  'cliente:planejamento': [
    {
      id: 'cliente_planejamento_jornada',
      title: 'Conheça sua jornada',
      description: 'Veja as etapas planejadas até a entrega.',
      href: '/jornada',
      ctaLabel: 'Ver jornada',
    },
    {
      id: 'cliente_planejamento_contrato',
      title: 'Confira o contrato',
      description: 'Leia e dê ciência nos termos da obra.',
      href: '/contrato',
      ctaLabel: 'Abrir contrato',
    },
    {
      id: 'cliente_planejamento_dados',
      title: 'Confirme seus dados',
      description: 'Endereço, contato e responsável pela obra.',
      href: '/dados-cliente',
      ctaLabel: 'Abrir dados',
    },
  ],
  'cliente:execucao': [
    {
      id: 'cliente_execucao_atualizacao',
      title: 'Veja a última atualização',
      description: 'Fotos e progresso desta semana.',
      href: '/cronograma',
      ctaLabel: 'Ver atualização',
    },
    {
      id: 'cliente_execucao_medicao',
      title: 'Aprove a medição do mês',
      description: 'Confira o que foi executado e dê ciência.',
      href: '/financeiro',
      ctaLabel: 'Ver medição',
    },
    {
      id: 'cliente_execucao_pendencias',
      title: 'Responda às pendências',
      description: 'Decisões aguardando você para a obra continuar.',
      href: '/pendencias',
      ctaLabel: 'Ver pendências',
    },
    {
      id: 'cliente_execucao_aprovacoes',
      title: 'Acompanhe aprovações',
      description: 'Formalizações pendentes da sua ciência.',
      href: '/formalizacoes',
      ctaLabel: 'Ver aprovações',
    },
  ],
  'cliente:entrega': [
    {
      id: 'cliente_entrega_vistoria',
      title: 'Confira a vistoria final',
      description: 'Lista de pequenos ajustes antes da entrega.',
      href: '/vistorias',
      ctaLabel: 'Ver vistoria',
    },
    {
      id: 'cliente_entrega_punchlist',
      title: 'Aponte ajustes finais',
      description: 'Algo que você notou e gostaria de revisar?',
      href: '/pendencias',
      ctaLabel: 'Apontar ajuste',
    },
    {
      id: 'cliente_entrega_documentacao',
      title: 'Receba a documentação',
      description: 'Manual do imóvel, garantias e as built.',
      href: '/documentos',
      ctaLabel: 'Ver documentos',
    },
  ],

  // ──────────────── Equipe ────────────────
  'equipe:planejamento': [
    {
      id: 'equipe_planejamento_cronograma',
      title: 'Monte o cronograma',
      description: 'Atividades, datas previstas e dependências.',
      href: '/cronograma',
      ctaLabel: 'Abrir cronograma',
    },
    {
      id: 'equipe_planejamento_compras',
      title: 'Planeje compras críticas',
      description: 'Itens com lead time alto entram primeiro.',
      href: '/compras',
      ctaLabel: 'Abrir compras',
    },
    {
      id: 'equipe_planejamento_documentos',
      title: 'Suba os projetos',
      description: 'Executivo, 3D e documentos legais.',
      href: '/documentos',
      ctaLabel: 'Abrir documentos',
    },
  ],
  'equipe:execucao': [
    {
      id: 'equipe_execucao_rdo',
      title: 'Lance o RDO de hoje',
      description: 'Mão de obra, clima, atividades e fotos.',
      href: '/relatorio',
      ctaLabel: 'Lançar RDO',
    },
    {
      id: 'equipe_execucao_recebimentos',
      title: 'Confirme compras recebidas',
      description: 'Marque o que chegou na obra hoje.',
      href: '/compras',
      ctaLabel: 'Ver compras',
    },
    {
      id: 'equipe_execucao_fotos',
      title: 'Atualize fotos da etapa',
      description: 'Cliente acompanha por aqui.',
      href: '/cronograma',
      ctaLabel: 'Subir fotos',
    },
    {
      id: 'equipe_execucao_medicao',
      title: 'Prepare medição do mês',
      description: 'Levante o executado para o fechamento.',
      href: '/financeiro',
      ctaLabel: 'Abrir medição',
    },
  ],
  'equipe:entrega': [
    {
      id: 'equipe_entrega_vistoria',
      title: 'Faça a vistoria final',
      description: 'Conferência item a item antes da entrega.',
      href: '/vistorias',
      ctaLabel: 'Iniciar vistoria',
    },
    {
      id: 'equipe_entrega_punchlist',
      title: 'Resolva a punch list',
      description: 'Lista de pequenos ajustes pendentes.',
      href: '/pendencias',
      ctaLabel: 'Ver pendências',
    },
    {
      id: 'equipe_entrega_asbuilt',
      title: 'Suba o as built',
      description: 'Versão final dos projetos com alterações de obra.',
      href: '/documentos',
      ctaLabel: 'Subir documento',
    },
    {
      id: 'equipe_entrega_desmobilizacao',
      title: 'Desmobilize o canteiro',
      description: 'Equipamentos, container e limpeza final.',
      href: '/atividades',
      ctaLabel: 'Abrir atividades',
    },
  ],

  // ──────────────── Admin ────────────────
  'admin:planejamento': [
    {
      id: 'admin_planejamento_obra',
      title: 'Cadastre sua primeira obra',
      description: 'Endereço, cliente, datas previstas.',
      href: '/gestao/painel-obras',
      ctaLabel: 'Nova obra',
    },
    {
      id: 'admin_planejamento_equipe',
      title: 'Convide a equipe',
      description: 'Engenheiros, arquitetos e gestores.',
      href: '/gestao/configuracoes',
      ctaLabel: 'Convidar',
    },
    {
      id: 'admin_planejamento_fornecedores',
      title: 'Configure fornecedores recorrentes',
      description: 'Acelera o cadastro de pedidos depois.',
      href: '/gestao/fornecedores',
      ctaLabel: 'Cadastrar fornecedor',
    },
  ],
  'admin:execucao': [
    {
      id: 'admin_execucao_indicadores',
      title: 'Acompanhe indicadores',
      description: 'Avanço, desvio, custo e qualidade no agregado.',
      href: '/gestao/indicadores',
      ctaLabel: 'Ver indicadores',
    },
    {
      id: 'admin_execucao_aprovacoes',
      title: 'Revise aprovações pendentes',
      description: 'Compras e formalizações aguardando você.',
      href: '/gestao/compras',
      ctaLabel: 'Ver pendências',
    },
    {
      id: 'admin_execucao_relatorios',
      title: 'Gere relatório semanal',
      description: 'Resumo automático para o cliente.',
      href: '/gestao/relatorios',
      ctaLabel: 'Abrir relatórios',
    },
  ],
  'admin:entrega': [
    {
      id: 'admin_entrega_indicadores',
      title: 'Feche os indicadores da obra',
      description: 'Resultado final: prazo, custo, qualidade.',
      href: '/gestao/indicadores',
      ctaLabel: 'Ver indicadores',
    },
    {
      id: 'admin_entrega_pesquisa',
      title: 'Envie pesquisa de satisfação',
      description: 'Feedback do cliente alimenta as próximas obras.',
      href: '/gestao/relatorios',
      ctaLabel: 'Enviar pesquisa',
    },
    {
      id: 'admin_entrega_arquivar',
      title: 'Arquive a obra',
      description: 'Sai do painel ativo, fica no histórico.',
      href: '/gestao/painel-obras',
      ctaLabel: 'Abrir painel',
    },
  ],
};

/** Retorna o fluxo para uma combinação papel × fase. */
export function getOnboardingFlow(
  role: OnboardingRole,
  status: ObraStatus,
): OnboardingStep[] {
  return onboardingFlows[`${role}:${status}` as OnboardingFlowKey] ?? [];
}
