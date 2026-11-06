/** Microcopy do PDF do cronograma e do envio por WhatsApp (sem travessão). */
export const CRONOGRAMA_PDF_COPY = {
  page: "Página",
  cover: {
    eyebrow: "Bewild Arquitetura e Construção",
    title: "Cronograma de obra",
    client: "Cliente",
    start: "Início",
    delivery: "Entrega prevista",
    revision: "Revisão",
    issued: "Emissão",
    revisionChange: (from: string, to: string) =>
      `Nesta revisão, a entrega prevista passou de ${from} para ${to}.`,
  },
  bars: {
    title: "Cronograma por semana",
    delivery: "Entrega prevista",
    legendWork: "Semana de obra",
    legendSlack: "Folga para repasses",
    legendActual: "Realizado",
    holidays: "Feriados no período",
  },
  weeks: { title: "O que acontece em cada semana" },
  follow: {
    title: "Acompanhamento",
    paragraphs: [
      "Você acompanha cada etapa da sua obra pelo Bwild Workflow: cronograma atualizado, relatórios semanais com fotos, documentos e pendências em um só lugar.",
      "Sempre que uma semana for concluída, o progresso aparece no seu painel. Se algo mudar, avisamos por lá e pelo WhatsApp.",
    ],
    channelsTitle: "Canais",
    channels: [
      "Bwild Workflow: bwildworkflow.com",
      "WhatsApp com o coordenador da sua obra",
    ],
    notesTitle: "Observações",
    notes: [
      "A data de início depende das liberações para a obra começar, como a autorização do condomínio.",
      "Mudanças pedidas durante a obra podem alterar o prazo.",
    ],
    footer: "Bewild Arquitetura e Construção",
  },
  errors: {
    empty: "Esta obra ainda não tem cronograma para exportar.",
    generic: "Não foi possível gerar o PDF. Tente de novo.",
    noPhone: "Informe o telefone do cliente para enviar pelo WhatsApp.",
  },
  ui: {
    export: "Exportar PDF",
    exporting: "Gerando PDF...",
    whatsapp: "Enviar por WhatsApp",
    sending: "Preparando envio...",
    planned: "Apenas planejado",
    comparison: "Planejado x realizado",
    exported: "Cronograma exportado",
    openPdf: "Abrir PDF",
    copyLink: "Copiar link",
    linkCopied: "Link copiado",
    newRevision: "Nova revisão",
    newRevisionHint: (n: number) =>
      `As datas mudaram desde a última exportação. Gerar a revisão R${n}?`,
    keepRevision: "Manter revisão atual",
    dialogTitle: "Enviar cronograma por WhatsApp",
    phoneLabel: "Telefone do cliente (com DDD)",
    shareNative: "Compartilhar PDF",
    openWhatsApp: "Abrir WhatsApp",
  },
  whatsappMessage: (p: {
    firstName: string;
    empreendimento: string;
    unidade: string;
    inicio: string;
    entrega: string;
    url: string;
  }) =>
    `Olá, ${p.firstName}! Segue o cronograma da sua obra no ${p.empreendimento}${p.unidade ? `, unidade ${p.unidade}` : ""}. Início ${p.inicio}, entrega prevista ${p.entrega}. Você acompanha tudo pelo Bwild Workflow. Link do PDF: ${p.url}`,
} as const;
