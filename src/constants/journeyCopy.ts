/**
 * Centralized copy dictionary for the Journey module.
 * All user-facing strings live here for consistency and future i18n.
 */
export const journeyCopy = {
  status: {
    current: {
      label: "Etapa atual",
      description: "Esta é a etapa em andamento no momento.",
    },
    completed: {
      label: "Concluída",
      description: "Esta etapa já foi finalizada.",
    },
    next: {
      label: "Próxima",
      description: "Esta será a próxima etapa assim que a atual for concluída.",
    },
    in_review: {
      label: "Em validação",
      description: "Estamos revisando os detalhes antes de avançar.",
    },
    blocked: {
      label: "Bloqueada",
      /** Use with template: replace {dependencyStageName} at runtime */
      description: "Disponível após concluir: {dependencyStageName}.",
    },
    future: {
      label: "Em breve",
    },
  },

  page: {
    title: "Jornada do Projeto",
    subtitle: "Acompanhe cada etapa com clareza e previsibilidade.",
    sidebarTitle: "Etapas da Jornada",
    welcome: {
      title: "Sua jornada com a Bwild começou",
      bullets: [
        "Acompanhe a etapa atual e o que vem a seguir.",
        "Conclua as pendências essenciais para avançarmos.",
        "Veja datas, documentos e aprovações em um só lugar.",
      ],
    },
    next_milestones: {
      title: "Próximas datas",
      empty: "Sem marcos definidos no momento.",
    },
  },

  stageSummary: {
    action_required: {
      title: "Ação necessária",
      subtitle: "Conclua os itens essenciais para avançarmos.",
    },
    all_good: {
      title: "Tudo certo por aqui",
      subtitle:
        "Nossa equipe está conduzindo esta etapa. Você verá por aqui se algo precisar de você.",
    },
    in_review: {
      title: "Em validação",
      subtitle: "Estamos conferindo os detalhes antes de seguir.",
    },
    next_step: {
      label: "Próximo passo",
      fallback: "Vamos atualizar assim que houver um próximo passo definido.",
    },
    items: "itens",
    dependsOn: "Depende de:",
  },

  checklist: {
    sections: {
      essential: {
        title: "Essenciais",
        subtitle: "Precisamos disso para avançar.",
      },
      recommended: {
        title: "Recomendados",
        subtitle: "Melhora a qualidade, mas não bloqueia a etapa.",
      },
    },
    item: {
      status_pending: "Pendente",
      status_done: "Concluído",
      done_inline: "Item concluído",
      link_documents: "Ver em Documentos",
    },
    toast: {
      done: "Concluído. Obrigado!",
      undone: "Atualizado.",
    },
    empty: "Sem pendências nesta etapa",
    add: "Adicionar",
    newItemPlaceholder: "Novo item...",
  },

  dates: {
    panel: {
      title: "Prazo de Entrega",
      empty_title: "Sem prazo definido",
      empty_body_client: "Assim que um prazo for definido, ele aparecerá aqui.",
      empty_body_admin: "Adicione um prazo de entrega para esta etapa.",
      newDate: "Nova data",
    },
    row: {
      confirmedLabel: "Prazo definido",
      proposedLabel: "Data sugerida pelo cliente",
    },
    status: {
      confirmed: "Confirmada pela Bwild",
      proposed: "Proposta pelo cliente",
      empty: "Sem data",
      notProposed: "Ainda não proposta",
      awaitingConfirmation: "Aguardando confirmação",
      inDefinition: "Em definição",
      selectDate: "Selecionar data",
      clearDate: "Limpar data",
    },
    types: {
      meeting: { emoji: "📅", label: "Reunião" },
      deadline: { emoji: "📨", label: "Prazo de envio" },
      start_planned: { emoji: "🟢", label: "Início estimado" },
      end_planned: { emoji: "🏁", label: "Entrega estimada" },
      milestone: { emoji: "⭐", label: "Marco importante" },
    } as Record<string, { emoji: string; label: string }>,
    miniTimeline: {
      title: "Linha do tempo",
      empty: "Datas aparecerão aqui conforme definidas.",
    },
    meeting: {
      scheduled_title: "Reunião agendada",
      scheduled_subtitle: "Você verá qualquer atualização por aqui.",
      pending_title: "Reunião: aguardando definição",
      pending_subtitle: "Assim que confirmarmos, a data aparecerá aqui.",
      confirmed: "Reunião confirmada",
      awaitingConfirmation: "Aguardando confirmação",
      chooseDateCta: "Escolher data da reunião",
      changeSuggestion: "Alterar sugestão",
      adjust: "Ajustar",
      confirmDate: "Confirmar data",
      customerMicrocopy:
        "Sua sugestão será analisada pela equipe Bwild. Entraremos em contato para confirmar a melhor data.",
    },
    form: {
      proposeTitle: "📅 Sugerir data e horário",
      confirmTitle: "✅ Confirmar data e horário",
      submitPropose: "Enviar sugestão",
      submitConfirm: "Confirmar",
      cancel: "Cancelar",
      notesPlaceholder: "Observação (opcional)",
      chooseDate: "Escolher data",
      timeLabel: "Horário",
      adjustProposal: "Ajustar proposta",
      suggestDate: "Sugerir data",
    },
    create: {
      title: "Nova data importante",
      titlePlaceholder: "Título (ex: Reunião de briefing)",
      create: "Criar",
      cancel: "Cancelar",
    },
    updated_banner: {
      text: "Data atualizada recentemente.",
    },
    history: {
      title: "Histórico de alterações",
      trigger: "Ver histórico",
      empty: "Nenhuma alteração registrada",
      emptySubtitle:
        "O histórico aparecerá aqui conforme as datas forem atualizadas.",
      actions: {
        proposed: "Sugeriu data",
        confirmed: "Confirmou data",
        adjusted: "Ajustou data",
        created: "Criou registro",
      } as Record<string, string>,
      roles: {
        customer: "Cliente",
        staff: "Bwild",
        admin: "Bwild",
      } as Record<string, string>,
    },
    divergence: {
      prefix: "A data confirmada difere da proposta em",
      suffix: "Em caso de dúvida, entre em contato com sua CSM.",
      day: "dia",
      days: "dias",
      customerSuggested: "O cliente sugeriu",
    },
  },

  errors: {
    load_stage: "Não foi possível carregar esta etapa. Tente novamente.",
    load_dates: "Não foi possível carregar as datas. Atualize a página.",
    save_date: "Não foi possível salvar a data. Verifique e tente novamente.",
    delete_date: "Não foi possível remover a data. Tente novamente.",
    generic: "Algo deu errado. Tente novamente.",
    save_suggestion: "Não foi possível salvar a sugestão. Tente novamente.",
    confirm_date: "Não foi possível confirmar a data. Tente novamente.",
    create_date: "Erro ao criar data. Tente novamente.",
    update_date: "Erro ao atualizar data. Tente novamente.",
    retry: "Tentar novamente",
  },

  toasts: {
    date_saved: "Data salva.",
    date_deleted: "Data removida.",
    date_updated: "Data atualizada",
    changes_saved: "Alterações salvas.",
  },

  a11y: {
    skip_to_content: "Pular para o conteúdo",
    open_stage: "Etapa: {stageName}",
    current_stage: "Etapa atual: {stageName}",
    milestone_item: "Marco: {title} em {date}",
    stagesNav: "Etapas da jornada",
    loadingHistory: "Carregando histórico",
    loadingDates: "Carregando datas",
    saving: "Salvando",
    editStage: "Editar etapa",
    cancelEdit: "Cancelar edição",
    saveEdit: "Salvar edição",
    selectDate: "Selecionar data",
  },

  tabs: {
    jornada: "Jornada",
    financeiro: "Financeiro",
    documentos: "Documentos",
    formalizacoes: "Formalizações",
    pendencias: "Pendências",
  },

  admin: {
    editStage: "Editar Etapa",
    editHero: "Editando Hero",
    fields: {
      name: "Nome",
      status: "Status",
      description: "Descrição",
      ctaText: "Texto do CTA",
      responsible: "Responsável",
      microcopy: "Microcopy",
      warning: "Aviso (warning)",
      dependencies: "Dependências",
      revisions: "Revisões",
    },
    statusOptions: {
      pending: "Em breve",
      waiting_action: "Aguardando ação",
      in_progress: "Em andamento",
      completed: "Concluído",
    },
  },

  loading: {
    initializing: "Inicializando jornada do projeto...",
    notFound: "Projeto não encontrado",
  },
} as const;
