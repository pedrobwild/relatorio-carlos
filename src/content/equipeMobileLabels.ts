/**
 * Copy das telas da equipe no celular (redesenho mobile, passo 1): barra
 * inferior, gaveta Registrar, lista de obras, hub da obra, Atualizar etapas e
 * relatório da semana em passos.
 *
 * Tom de voz: ver `docs/TOM_DE_VOZ.md`. Frases curtas, sem travessão.
 */

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export const equipeMobileLabels = {
  nav: {
    registrar: "Registrar",
  },

  fotosGuardadas: {
    guardada: (n: number) => (n === 1 ? "Foto guardada no aparelho" : `${n} fotos guardadas no aparelho`),
    entraram: (n: number) =>
      n === 1 ? "1 foto guardada entrou no relatório" : `${n} fotos guardadas entraram no relatório`,
    esperando: (n: number) =>
      n === 1
        ? "1 foto guardada no aparelho. Abra o relatório para enviar."
        : `${n} fotos guardadas no aparelho. Abra o relatório para enviar.`,
    cheia: "Muitas fotos guardadas no aparelho. Abra o relatório da semana para enviá-las.",
    erro: "Não deu para guardar a foto. Tente de novo.",
  },

  relatorioStatus: {
    neutro: "Abrir relatório da semana",
    semRelatorio: "Semana ainda sem relatório",
    rascunho: (fotos: number) =>
      fotos > 0 ? `Rascunho salvo · ${fotos} ${fotos === 1 ? "foto" : "fotos"}` : "Rascunho salvo",
  },

  registrar: {
    title: "Registrar",
    subtitle: "O que aconteceu na obra?",
    obra: "Obra",
    trocar: "Trocar",
    escolherObra: "Escolha a obra",
    buscarObra: "Buscar obra",
    nenhumaObra: "Nenhuma obra encontrada",
    foto: { title: "Foto da obra", hint: "Abre a câmera" },
    etapa: { title: "Etapa começou ou terminou", hint: "Lançar a data real" },
    relatorio: { title: "Relatório da semana" },
    pendencia: { title: "Pendência ou problema", hint: "Com foto e responsável" },
  },

  obras: {
    title: "Obras",
    resumo: (ativas: number, atencao: number) =>
      atencao > 0
        ? `${ativas} em andamento · ${atencao} ${atencao === 1 ? "pede" : "pedem"} atenção`
        : `${ativas} em andamento`,
    buscar: "Buscar obra ou cliente",
    filtros: { todas: "Todas", atencao: "Atenção", minhas: "Minhas" },
    filtrosLabel: "Quais obras",
    etapasParaAtualizar: (n: number) => plural(n, "etapa para atualizar", "etapas para atualizar"),
    tudoEmDia: "Tudo em dia",
    semCronograma: "Sem cronograma",
    diasDeAtraso: (n: number) => plural(n, "dia de atraso", "dias de atraso"),
    noPrazo: "No prazo",
    atencao: "Atenção",
    semPrazo: "Sem prazo",
    paralisada: "Paralisada",
    progresso: (pct: number) => `${pct}% concluído`,
    outrasListas: "Outras listas",
    emProjeto: (n: number) => `Em projeto (${n})`,
    concluidas: (n: number) => `Concluídas (${n})`,
    painelCompleto: "Painel completo",
    listaSimples: "Voltar para a lista de obras",
    vazio: {
      title: "Nenhuma obra em andamento",
      description: "Quando uma obra começa, ela aparece aqui.",
    },
    vazioFiltro: {
      title: "Nenhuma obra neste filtro",
      action: "Ver todas",
    },
    vazioBusca: (q: string) => `Nada encontrado para "${q}"`,
    limparBusca: "Limpar busca",
    erro: "Não deu para carregar as obras",
    tentarDeNovo: "Tentar de novo",
  },

  hub: {
    voltar: "Voltar para Obras",
    trocarDeObra: "trocar de obra",
    previstoHoje: (pct: number) => `previsto para hoje: ${pct}%`,
    etapaAtual: (nome: string) => `Etapa atual: ${nome}`,
    semEtapaAtual: "Sem etapa em andamento",
    entrega: (ddmm: string) => `Entrega ${ddmm}`,
    paraFazer: "Para fazer nesta obra",
    atualizarEtapas: "Atualizar etapas",
    esperando: (n: number) => plural(n, "esperando data real", "esperando data real"),
    etapasEmDia: "Datas reais em dia",
    relatorio: "Relatório da semana",
    foto: "Tirar foto da obra",
    fotoHint: "Fica guardada e entra no relatório da semana",
    mais: "Mais da obra",
    cronograma: "Cronograma completo",
    cronogramaInterno: "Cronograma interno",
    compras: "Compras",
    ficha: "Ficha da obra",
    documentos: "Documentos",
    relatorios: "Relatórios anteriores",
    vistorias: "Vistorias e NC",
    equipe: "Equipe e observações",
  },

  etapas: {
    title: "Atualizar etapas",
    voltar: "Voltar para a obra",
    salvo: "Salvo",
    salvando: "Salvando",
    paraHoje: (n: number) => `Para atualizar hoje (${n})`,
    proximas: (n: number) => `Próximas (${n})`,
    concluidas: (n: number) => `Concluídas (${n})`,
    previsto: (a: string, b: string) => `Previsto ${a} a ${b}`,
    comecou: (d: string) => `começou ${d}`,
    terminou: (d: string) => `terminou ${d}`,
    semInicio: "sem início",
    comecouHoje: "Começou hoje",
    terminouHoje: "Terminou hoje",
    outraData: "Outra data",
    editarDatas: "Editar datas",
    informarDatas: "Informar datas",
    chip: {
      atrasada: (n: number) => plural(n, "dia de atraso", "dias de atraso"),
      sem_inicio: "Não começou",
      comeca_hoje: "Começa hoje",
      em_andamento: "Em andamento",
      futura: "Próxima",
      concluida: "Concluída",
    },
    toastComecou: (nome: string) => `${nome}: começou`,
    toastTerminou: (nome: string) => `${nome}: terminou`,
    toastSalvo: "Datas reais salvas",
    toastLimpo: "Data removida",
    desfazer: "Desfazer",
    vazioHoje: "Nenhuma etapa pede data real hoje.",
    vazio: {
      title: "Esta obra ainda não tem cronograma",
      description: "Monte o cronograma para lançar as datas reais das etapas.",
    },
    erro: "Não deu para carregar as etapas",
    tentarDeNovo: "Tentar de novo",
    somenteLeitura: "Você pode ver as datas, mas não tem permissão para alterar.",
  },

  datasReais: {
    title: "Datas reais",
    comecou: "Começou",
    terminou: "Terminou",
    semData: "Sem data",
    atalhos: { hoje: "Hoje", ontem: "Ontem" },
    limpar: "Limpar data",
    salvar: (d: string | null) => (d ? `Salvar ${d}` : "Salvar"),
    erros: {
      futuro: "A data real não pode ser no futuro.",
      termino_antes_do_inicio: "O término não pode ser antes do início.",
      inicio_depois_do_termino: "O início não pode ser depois do término.",
      inicio_obrigatorio: "Limpe o término antes de limpar o início.",
    },
  },

  relatorio: {
    title: (semana: number) => `Relatório · semana ${semana}`,
    voltar: "Voltar",
    passoDe: (n: number, total: number) => `Passo ${n} de ${total}`,
    passos: ["Fotos", "Resumo", "Próxima semana", "Atenção", "Enviar"],
    continuar: (proximo: string) => `Continuar: ${proximo}`,
    anterior: "Voltar um passo",
    fotos: {
      title: "Fotos da semana",
      hint: "Comece pelas fotos. O texto vem depois.",
      tirar: "Tirar foto",
      galeria: "Da galeria",
      contagem: (n: number, enviando: number) =>
        enviando > 0 ? `${plural(n, "foto", "fotos")} · ${enviando} enviando` : plural(n, "foto", "fotos"),
      enviando: "Enviando",
      naFila: "Na fila",
      naoEnviada: "Não enviada",
      ambiente: "Ambiente",
      ambientePlaceholder: "Ex.: Cozinha, Banheiro",
      legenda: "Legenda",
      legendaPlaceholder: "O que a foto mostra",
      remover: (n: number) => `Remover foto ${n}`,
      foto: (n: number) => `Foto ${n}`,
      offline:
        "Sem sinal na obra? As fotos ficam guardadas no celular e sobem quando a conexão voltar.",
    },
    resumo: {
      title: "Resumo da semana",
      hint: "Em poucas frases: o que foi feito nesta semana.",
      placeholder: "Ex.: Concluímos o revestimento do banheiro e iniciamos a pintura.",
      formatado: "Este resumo tem formatação. Edite no computador para manter negrito e listas.",
    },
    proxima: {
      title: "Próxima semana",
      hint: "O que está planejado para os próximos dias.",
    },
    atencao: {
      title: "Pontos de atenção",
      hint: "Riscos, decisões do cliente e ocorrências. Pode ficar vazio.",
    },
    enviar: {
      title: "Conferir e salvar",
      hint: "Confira o que entra no relatório. Dá para voltar e ajustar qualquer passo.",
      fotos: (n: number) => plural(n, "foto", "fotos"),
      resumoOk: "Resumo preenchido",
      resumoFalta: "Resumo em branco",
      tarefas: (n: number) => plural(n, "atividade planejada", "atividades planejadas"),
      atencao: (n: number) => plural(n, "ponto de atenção", "pontos de atenção"),
      uploadsPendentes: (n: number) =>
        `${plural(n, "foto ainda está", "fotos ainda estão")} subindo. O relatório é salvo mesmo assim e as fotos entram quando o envio terminar.`,
      salvar: "Salvar relatório",
      salvando: "Salvando",
      ir: "Ajustar",
    },
    semSemana: {
      title: "Ainda não há semana de relatório",
      description: "O relatório semanal aparece quando a obra tem cronograma com datas.",
      action: "Voltar para a obra",
    },
    carregando: "Carregando relatório da semana",
    semPermissao: {
      title: "Sem permissão para editar o relatório",
      description: "Peça acesso ao responsável pela obra.",
    },
  },
} as const;
