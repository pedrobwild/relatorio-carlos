// Seed Data - Semana 10 - Hub Brooklyn 502
import { WeeklyReportData } from "@/types/weeklyReport";

import cabeceiraDormitorio from "@/assets/gallery/cabeceira-dormitorio.jpg";
import prateleirasDormitorio from "@/assets/gallery/prateleiras-dormitorio.jpg";
import bancadaDormitorio from "@/assets/gallery/bancada-dormitorio.jpg";
import armarioBanheiro from "@/assets/gallery/armario-banheiro.jpg";
import moduloCozinha from "@/assets/gallery/modulo-cozinha.jpg";
import armarioHall from "@/assets/gallery/armario-hall.jpg";
import infiltracaoParede from "@/assets/gallery/infiltracao-parede.jpg";

export const week10SeedData: WeeklyReportData = {
  projectId: "hub-brooklyn-502",
  projectName: "Hub Brooklyn",
  unitName: "502",
  clientName: "Pedro Alves",
  weekNumber: 10,
  periodStart: "2025-09-02",
  periodEnd: "2025-09-08",
  issuedAt: "2025-09-08",
  preparedBy: "Eng. Pedro Henrique",

  kpis: {
    physicalPlanned: 93,
    physicalActual: 93,
    scheduleVarianceDays: 0,
  },

  nextMilestones: [
    {
      description: "Concluir instalação de mobiliário e eletros",
      dueDate: "2025-09-10",
      status: "pending",
    },
    { description: "Limpeza fina", dueDate: "2025-09-11", status: "pending" },
    {
      description: "Vistoria de qualidade",
      dueDate: "2025-09-12",
      status: "pending",
    },
    {
      description: "Conclusão/Entrega",
      dueDate: "2025-09-14",
      status: "pending",
    },
  ],

  executiveSummary:
    "Concluída a instalação de todos os módulos de marcenaria previstos no Projeto Executivo, com 100% de conformidade na vistoria técnica.\n\nA vistoria é composta por 48 critérios de aceitação, considerados essenciais pela Bwild.\n\nEm resumo: gavetões com movimento suave, portas com abertura/fechamento sem ruídos e alinhamento consistente.\n\nAcabamento de alta qualidade, durabilidade garantida, ausência de riscos, lascas ou danos aparentes nos módulos e frentes.",

  // Pesos refletem proporção real do trabalho (soma = 100%)
  // Marcenaria concluída = 93% da obra pronta, restante = 7% em 5 dias
  activities: [
    {
      activityId: "1",
      description: "Preparação e Mobilização",
      plannedStart: "2025-07-01",
      plannedEnd: "2025-07-05",
      actualStart: "2025-07-01",
      actualEnd: "2025-07-04",
      status: "concluído",
      varianceDays: -1,
      percentComplete: 100,
      weight: 5, // 5% do projeto
    },
    {
      activityId: "2",
      description: "Proteções, demolições e infraestrutura",
      plannedStart: "2025-07-07",
      plannedEnd: "2025-07-18",
      actualStart: "2025-07-05",
      actualEnd: "2025-07-19",
      status: "concluído",
      varianceDays: 1,
      percentComplete: 100,
      weight: 15, // 15% do projeto
    },
    {
      activityId: "3",
      description: "Pisos, revestimentos, bancadas e box",
      plannedStart: "2025-07-21",
      plannedEnd: "2025-08-03",
      actualStart: "2025-07-21",
      actualEnd: "2025-08-03",
      status: "concluído",
      varianceDays: 0,
      percentComplete: 100,
      weight: 20, // 20% do projeto
    },
    {
      activityId: "4",
      description: "Pinturas e metais",
      plannedStart: "2025-08-04",
      plannedEnd: "2025-08-10",
      actualStart: "2025-08-06",
      actualEnd: "2025-08-12",
      status: "concluído",
      varianceDays: 2,
      percentComplete: 100,
      weight: 10, // 10% do projeto
    },
    {
      activityId: "5",
      description: "Instalações e elétrica",
      plannedStart: "2025-08-11",
      plannedEnd: "2025-08-17",
      actualStart: "2025-08-14",
      actualEnd: "2025-08-17",
      status: "concluído",
      varianceDays: 0,
      percentComplete: 100,
      weight: 10, // 10% do projeto
    },
    {
      activityId: "6",
      description: "Conclusão da Marcenaria",
      plannedStart: "2025-08-20",
      plannedEnd: "2025-09-05",
      actualStart: "2025-08-20",
      actualEnd: "2025-09-05",
      status: "concluído",
      varianceDays: 0,
      percentComplete: 100,
      weight: 33, // 33% do projeto - maior etapa
    },
    {
      activityId: "7",
      description: "Etapa atual: Instalação de mobiliário e eletros",
      plannedStart: "2025-09-08",
      plannedEnd: "2025-09-10",
      actualStart: "2025-09-08",
      status: "em andamento",
      varianceDays: 0,
      percentComplete: 30,
      weight: 3, // 3% do projeto
    },
    {
      activityId: "8",
      description: "Limpeza fina",
      plannedStart: "2025-09-11",
      plannedEnd: "2025-09-11",
      status: "pendente",
      varianceDays: 0,
      percentComplete: 0,
      weight: 2, // 2% do projeto
    },
    {
      activityId: "9",
      description: "Vistoria de qualidade",
      plannedStart: "2025-09-12",
      plannedEnd: "2025-09-12",
      status: "pendente",
      varianceDays: 0,
      percentComplete: 0,
      weight: 1, // 1% do projeto
    },
    {
      activityId: "10",
      description: "Conclusão",
      plannedStart: "2025-09-14",
      plannedEnd: "2025-09-14",
      status: "pendente",
      varianceDays: 0,
      percentComplete: 0,
      weight: 1, // 1% do projeto
    },
  ],

  deliverablesCompleted: [
    {
      id: "1",
      description: "Dormitório (suíte) — Cabeceira em marcenaria com LED",
      completed: true,
      subItems: [
        {
          id: "1-1",
          description:
            "LED funcionando e bem arrematado (sem frestas/irregularidades)",
        },
        {
          id: "1-2",
          description: "Acabamento íntegro: sem riscos/lascas/danos aparentes",
        },
      ],
    },
    {
      id: "2",
      description: "Dormitório — Nichos e prateleiras",
      completed: true,
      subItems: [
        {
          id: "2-1",
          description: 'Nivelamento correto (sem "caimento" visual)',
        },
        {
          id: "2-2",
          description: "Encontros e bordas bem acabados (sem rebarbas/lasca)",
        },
      ],
    },
    {
      id: "3",
      description:
        "Home office — Bancada multiuso + prateleira + módulos verticais",
      completed: true,
      subItems: [
        {
          id: "3-1",
          description: "Conjunto alinhado e estável (sem jogo/torção)",
        },
        {
          id: "3-2",
          description:
            "Acabamento limpo nas junções e quinas (sem marcas aparentes)",
        },
      ],
    },
    {
      id: "4",
      description: "Banheiro social — Gabinete inferior",
      completed: true,
      subItems: [
        {
          id: "4-1",
          description: "Portas/gavetas com movimento suave e sem ruídos",
        },
        {
          id: "4-2",
          description: "Frentes alinhadas e acabamento sem avarias aparentes",
        },
      ],
    },
    {
      id: "5",
      description: "Cozinha — Marcenaria completa (inferiores + organização)",
      completed: true,
      subItems: [
        {
          id: "5-1",
          description:
            "Gavetas/gavetões com deslizamento suave e fechamento silencioso",
        },
        {
          id: "5-2",
          description:
            "Portas com fechamento correto e sem ruídos (folgas uniformes)",
        },
        {
          id: "5-3",
          description:
            "Inclui: armários inferiores, gavetas e gavetões, vassoureiro horizontal e módulos complementares",
        },
      ],
    },
    {
      id: "6",
      description: "Hall de entrada — Armário multiuso",
      completed: true,
      subItems: [
        {
          id: "6-1",
          description:
            "Portas alinhadas com fechamento firme (sem bater/pegar)",
        },
        {
          id: "6-2",
          description: "Superfícies sem riscos/lascas/danos aparentes",
        },
      ],
    },
  ],

  lookaheadTasks: [
    {
      id: "1",
      date: "2025-09-09",
      description:
        "Instalar cooktop Fischer 4 bocas (vitrocerâmico) + coifa Tramontina 60cm (modelo Vetro)",
      prerequisites:
        "Confirmação de entrega pelo fornecedor + liberação da administração do condomínio para furação de duto",
      responsible: "Equipe de instalação - Técnico João",
      risk: "médio",
      riskReason:
        "Dificuldade para contornar a restrição em relação a instalação da coifa que não constava no memorial descritivo do condomínio.",
    },
    {
      id: "2",
      date: "2025-09-10",
      description:
        "Instalar forno elétrico Electrolux OE8EX 80L + micro-ondas Panasonic 32L (embutidos) + teste de funcionamento completo",
      prerequisites:
        "Cooktop e coifa instalados + circuito elétrico dedicado 220V liberado + nicho marcenaria conferido (60x60cm)",
      responsible: "Equipe de instalação - Técnico João",
      risk: "baixo",
    },
    {
      id: "3",
      date: "2025-09-11",
      description:
        "Limpeza fina completa: remoção de proteções, limpeza de vidros, aspiração de rejuntes, polimento de metais e superfícies",
      prerequisites:
        "100% das instalações de eletros concluídas + verificação de ausência de pendências de marcenaria",
      responsible: "Equipe de limpeza especializada - Clean Pro",
      risk: "baixo",
    },
    {
      id: "4",
      date: "2025-09-12",
      description:
        "Vistoria de qualidade: checklist de 47 itens (elétrica, hidráulica, marcenaria, acabamentos) + registro fotográfico + correções pontuais identificadas",
      prerequisites:
        "Limpeza fina 100% concluída + acesso liberado a todos os ambientes + presença do cliente opcional",
      responsible: "Eng. Pedro Henrique",
      risk: "baixo",
    },
    {
      id: "5",
      date: "2025-09-13",
      description:
        "Vistoria final com cliente + assinatura do Termo de Entrega + orientações de uso e manutenção + entrega de documentação (garantias, manuais, projetos as-built)",
      prerequisites:
        "Vistoria interna aprovada + todas as não-conformidades corrigidas + documentação compilada",
      responsible: "Gestão de obra - Ana Paula",
      risk: "baixo",
    },
  ],

  risksAndIssues: [
    {
      id: "1",
      type: "risco",
      title:
        "Atraso de 48h na entrega da geladeira Samsung RF27 Side by Side (inox)",
      description:
        "Transportadora Fast Cargo sinalizou possível atraso na entrega prevista para 09/09 devido a problemas logísticos no CD de Guarulhos.",
      impact: { time: "médio", cost: "baixo", quality: "baixo" },
      severity: "média",
      actionPlan:
        "Contato direto com gerente Fast Cargo (Carlos - 11 98765-4321) para priorização\nPlano B: entrega parcial e instalação posterior",
      owner: "Suprimentos - Marina",
      dueDate: "2025-09-09",
      status: "em acompanhamento",
    },
    {
      id: "2",
      type: "problema",
      title:
        "Empeno de 3mm na porta do armário superior esquerdo da cozinha (módulo AS-01)",
      description:
        "Identificado durante inspeção de qualidade: porta de MDF 18mm com laminado branco apresenta empeno que compromete fechamento soft-close e alinhamento visual.",
      impact: { time: "baixo", cost: "baixo", quality: "médio" },
      severity: "média",
      actionPlan:
        "Marceneiro Antônio realizará troca da porta (peça reserva em estoque)\nReinstalação das dobradiças Blum\nNova inspeção de alinhamento pós-troca",
      owner: "Marcenaria - Antônio",
      dueDate: "2025-09-10",
      status: "aberto",
    },
    {
      id: "3",
      type: "impedimento",
      title:
        "Reserva obrigatória de elevador de serviço para transporte de eletrodomésticos",
      description:
        "Regulamento do condomínio Hub Brooklyn exige agendamento prévio de 48h para uso exclusivo do elevador de serviço. Eletros grandes (geladeira 1,80m, fogão) excedem limite de escada.",
      impact: { time: "alto", cost: "baixo", quality: "baixo" },
      severity: "alta",
      actionPlan:
        "Reserva já solicitada para 09/09 das 8h às 12h (protocolo #2847)\nConfirmação com portaria Sr. José\nBackup: reserva secundária para 10/09 caso haja atraso de entrega",
      owner: "Gestão de obra - Ana Paula",
      dueDate: "2025-09-09",
      status: "ação imediata",
    },
  ],

  qualityItems: [
    {
      checklistName: "Instalações Elétricas - Verificação Final",
      items: [
        {
          name: "Teste de funcionamento dos disjuntores (QDC principal + QDC secundário) - atuação em <30ms",
          executed: true,
          result: "aprovado",
        },
        {
          name: "Verificação de aterramento - resistência <10Ω conforme NBR 5410",
          executed: true,
          result: "aprovado",
        },
        {
          name: "Teste de polaridade em todas as tomadas (fase/neutro/terra) - 24 pontos verificados",
          executed: true,
          result: "aprovado",
        },
        {
          name: "Medição de tensão nos circuitos 127V (tolerância ±10%) e 220V (tolerância ±5%)",
          executed: true,
          result: "aprovado",
        },
        {
          name: "Teste de funcionamento de iluminação - 18 pontos LED dimerizáveis + 4 spots direcionáveis",
          executed: true,
          result: "aprovado",
        },
        {
          name: "Verificação de circuitos dedicados: ar-condicionado (2x), cooktop (1x), forno (1x), chuveiro (2x)",
          executed: true,
          result: "aprovado",
        },
      ],
      nonConformities: [],
      pendingItems: [],
    },
    {
      checklistName: "Marcenaria - Inspeção de Qualidade",
      items: [
        {
          name: "Alinhamento de portas e gavetas - tolerância máxima 2mm de desvio vertical/horizontal",
          executed: true,
          result: "aprovado",
        },
        {
          name: "Verificação de empenamento em portas MDF 18mm - tolerância máxima 3mm em diagonal 1m",
          executed: true,
          result: "reprovado",
        },
        {
          name: "Teste de dobradiças Blum Clip Top - abertura 110°, soft-close funcional",
          executed: true,
          result: "aprovado",
        },
        {
          name: "Teste de corrediças Blum Tandem - extensão total, carga 30kg, fechamento suave",
          executed: true,
          result: "aprovado",
        },
        {
          name: "Instalação de puxadores - alinhamento horizontal, fixação com parafusos M4x25mm",
          executed: true,
          result: "aprovado",
        },
        {
          name: "Verificação de acabamento laminado - ausência de bolhas, descolamento ou riscos",
          executed: true,
          result: "aprovado",
        },
        {
          name: "Arremates e encontros - rodapés, laterais cegas, tamponamentos com tolerância <1mm",
          executed: true,
          result: "aprovado",
        },
      ],
      nonConformities: [
        {
          id: "nc-1",
          description:
            "Porta armário superior esquerdo cozinha (AS-01) com empeno de 3mm - excede tolerância de 2mm. Causa provável: armazenamento inadequado pré-instalação.",
          responsible: "Marcenaria - Antônio",
          correctionDate: "2025-09-10",
          status: "aberto",
        },
      ],
      pendingItems: [
        {
          id: "pi-1",
          description:
            "Substituição de porta AS-01 por peça reserva + reinstalação de dobradiças Blum",
          severity: "amarelo",
          dueDate: "2025-09-10",
        },
        {
          id: "pi-2",
          description:
            "Retoque de pintura acrílica acetinada (Suvinil Branco Neve) em pontos de fixação da marcenaria",
          severity: "amarelo",
          dueDate: "2025-09-11",
        },
      ],
    },
    {
      checklistName: "Áreas Molhadas - Estanqueidade e Acabamentos",
      items: [
        {
          name: "Teste de estanqueidade box - 48h sem infiltração, silicone Sika transparente",
          executed: true,
          result: "aprovado",
        },
        {
          name: "Vedação de bancadas granito/cuba - selante poliuretano Sikaflex em todo perímetro",
          executed: true,
          result: "aprovado",
        },
        {
          name: "Arremates de silicone neutro em encontros parede/piso/louças - acabamento liso",
          executed: true,
          result: "aprovado",
        },
        {
          name: "Verificação de caimento de piso box - mínimo 1% em direção ao ralo linear",
          executed: true,
          result: "aprovado",
        },
        {
          name: "Teste de escoamento de ralos - vazão mínima 0,5L/s sem acúmulo",
          executed: true,
          result: "aprovado",
        },
        {
          name: "Verificação de rejunte epóxi em áreas de respingo - sem falhas ou fissuras",
          executed: true,
          result: "aprovado",
        },
      ],
      nonConformities: [],
      pendingItems: [],
    },
    {
      checklistName: "Pintura e Acabamentos Gerais",
      items: [
        {
          name: "Verificação de uniformidade de cor - comparação com amostra aprovada (NCS S 0500-N)",
          executed: true,
          result: "aprovado",
        },
        {
          name: "Inspeção de cobertura - sem transparência do substrato, mínimo 2 demãos",
          executed: true,
          result: "aprovado",
        },
        {
          name: "Verificação de cantos e arestas - linha reta, sem escorridos ou acúmulos",
          executed: true,
          result: "aprovado",
        },
        {
          name: "Teste de aderência - corte em X sem desplacamento conforme NBR 11003",
          executed: true,
          result: "aprovado",
        },
        {
          name: "Verificação de rodapés e molduras - alinhamento, ausência de frestas >0,5mm",
          executed: true,
          result: "aprovado",
        },
      ],
      nonConformities: [],
      pendingItems: [],
    },
    {
      checklistName: "Hidráulica - Verificação Final",
      items: [
        {
          name: "Teste de pressão em ramais - manutenção de 4 bar por 15min sem queda",
          executed: true,
          result: "aprovado",
        },
        {
          name: "Verificação de vazamentos em conexões - inspeção visual + teste de papel",
          executed: true,
          result: "aprovado",
        },
        {
          name: "Teste de funcionamento de registros e válvulas - abertura/fechamento completo",
          executed: true,
          result: "aprovado",
        },
        {
          name: "Verificação de vazão em pontos de consumo - torneiras >6L/min, chuveiros >12L/min",
          executed: true,
          result: "aprovado",
        },
        {
          name: "Teste de aquecedor a gás - ignição, chama azul estável, exaustão adequada",
          executed: true,
          result: "aprovado",
        },
      ],
      nonConformities: [],
      pendingItems: [],
    },
  ],

  clientDecisions: [
    {
      id: "cd-1",
      description:
        'Definir posição final do suporte articulado de TV 65" na sala',
      options: [
        "Altura 1,10m centralizado",
        "Altura 1,10m deslocado 15cm esquerda",
        "Altura 1,20m centralizado",
        "Agendar visita para definir no local",
      ],
      impactIfDelayed:
        "Atraso na instalação elétrica embutida e possível necessidade de retrabalho no gesso/pintura",
      dueDate: "2025-09-09",
      status: "pending",
    },
    {
      id: "cd-2",
      description:
        "Aprovar torneira alternativa para lavatório do banheiro social: modelo Docol Bistro Cromado (original Deca Polo indisponível até 20/09)",
      options: [
        "Aceitar Docol Bistro Cromado (entrega imediata, acabamento similar)",
        "Aguardar Deca Polo original (atraso de 12 dias no banheiro)",
        "Escolher outro modelo equivalente (enviar opções)",
      ],
      impactIfDelayed:
        "Banheiro social não concluído até entrega - necessário vistoria parcial",
      dueDate: "2025-09-10",
      status: "pending",
    },
  ],

  incidents: [
    {
      id: "inc-1",
      occurrence:
        "Foi identificado no dia 06/07 uma mancha que é um típico sinal de infiltração, de aproximadamente 4,5m² na parede em que foi instalada a cabeceira.",
      occurrenceDate: "2025-07-06",
      cause:
        "Vazamento no sistema hidráulico do banheiro da unidade logo acima.",
      action:
        "Chamado de urgência aberto no sistema para a construtora, única capaz de cessar o vazamento.",
      impact:
        "Será necessário nova pintura no local. Atividade não prevista no escopo do contrato. A execução dependente do aceite do orçamento e assinatura do aditivo pelo cliente.",
      status: "em andamento",
      expectedResolutionDate: "2025-09-14",
      photos: [
        {
          id: "inc-1-photo-1",
          url: infiltracaoParede,
          caption: "Mancha de infiltração identificada na parede do dormitório",
        },
      ],
    },
  ],

  gallery: [
    {
      id: "1",
      url: cabeceiraDormitorio,
      caption:
        "Cabeceira estofada dormitório suíte - MDF 18mm com revestimento linho cinza, iluminação LED embutida, 2,40m x 1,20m",
      area: "Dormitório Suíte",
      date: "2025-09-08",
      category: "Marcenaria",
    },
    {
      id: "2",
      url: prateleirasDormitorio,
      caption:
        "Nichos e prateleiras dormitório - MDF branco TX 25mm, fixação invisível, conjunto de 4 peças (60x25cm cada)",
      area: "Dormitório Suíte",
      date: "2025-09-08",
      category: "Marcenaria",
    },
    {
      id: "3",
      url: bancadaDormitorio,
      caption:
        "Bancada de trabalho home office - MDF carvalho 30mm, 1,80m x 0,60m, com passa-fios embutido e gaveta organizadora",
      area: "Dormitório Suíte",
      date: "2025-09-08",
      category: "Marcenaria",
    },
    {
      id: "4",
      url: armarioBanheiro,
      caption:
        "Gabinete banheiro social suspenso - MDF branco com portas push-to-open, cuba de apoio Deca L.68, 0,80m x 0,45m",
      area: "Banheiro Social",
      date: "2025-09-08",
      category: "Marcenaria",
    },
    {
      id: "5",
      url: moduloCozinha,
      caption:
        "Módulo inferior cozinha com gavetões - MDF branco, corrediças Blum full-extension, tampo granito preto São Gabriel 3cm",
      area: "Cozinha",
      date: "2025-09-08",
      category: "Marcenaria",
    },
    {
      id: "6",
      url: armarioHall,
      caption:
        "Armário multiuso hall de entrada - MDF freijó com portas de correr espelhadas, 2,60m altura x 1,20m largura x 0,50m profundidade",
      area: "Hall de Entrada",
      date: "2025-09-08",
      category: "Marcenaria",
    },
  ],

  roomsProgress: [
    {
      id: "room-1",
      name: "Dormitório Suíte",
      status: "concluído",
      render3D: {
        url: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=400&h=300&fit=crop",
        caption: "Projeto 3D - Dormitório com cabeceira LED e nichos",
        date: "2025-06-15",
      },
      before: {
        url: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=300&fit=crop",
        caption: "Ambiente antes da reforma - paredes originais",
        date: "2025-07-01",
      },
      during: {
        url: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop",
        caption: "Instalação de infraestrutura elétrica e gesso",
        date: "2025-08-15",
      },
      after: {
        url: cabeceiraDormitorio,
        caption: "Cabeceira com LED e nichos instalados",
        date: "2025-09-08",
      },
    },
    {
      id: "room-2",
      name: "Cozinha",
      status: "concluído",
      render3D: {
        url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop",
        caption: "Projeto 3D - Cozinha planejada com ilha",
        date: "2025-06-15",
      },
      before: {
        url: "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=400&h=300&fit=crop",
        caption: "Cozinha original do apartamento",
        date: "2025-07-01",
      },
      during: {
        url: "https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?w=400&h=300&fit=crop",
        caption: "Instalação de revestimentos e bancada",
        date: "2025-08-20",
      },
      after: {
        url: moduloCozinha,
        caption: "Marcenaria completa com gavetões Blum",
        date: "2025-09-08",
      },
    },
    {
      id: "room-3",
      name: "Banheiro Social",
      status: "concluído",
      render3D: {
        url: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=400&h=300&fit=crop",
        caption: "Projeto 3D - Banheiro com gabinete suspenso",
        date: "2025-06-15",
      },
      before: {
        url: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&h=300&fit=crop",
        caption: "Banheiro antes da reforma",
        date: "2025-07-01",
      },
      during: {
        url: "https://images.unsplash.com/photo-1585128792020-803d29415281?w=400&h=300&fit=crop",
        caption: "Impermeabilização e instalação de box",
        date: "2025-08-10",
      },
      after: {
        url: armarioBanheiro,
        caption: "Gabinete suspenso com cuba Deca",
        date: "2025-09-08",
      },
    },
    {
      id: "room-4",
      name: "Hall de Entrada",
      status: "concluído",
      render3D: {
        url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop",
        caption: "Projeto 3D - Hall com armário multiuso",
        date: "2025-06-15",
      },
      before: {
        url: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400&h=300&fit=crop",
        caption: "Hall original sem mobiliário",
        date: "2025-07-01",
      },
      during: {
        url: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400&h=300&fit=crop",
        caption: "Preparação para instalação do armário",
        date: "2025-08-25",
      },
      after: {
        url: armarioHall,
        caption: "Armário multiuso com portas espelhadas",
        date: "2025-09-08",
      },
    },
    {
      id: "room-5",
      name: "Sala de Estar",
      status: "em andamento",
      render3D: {
        url: "https://images.unsplash.com/photo-1618219908412-a29a1bb7b86e?w=400&h=300&fit=crop",
        caption: "Projeto 3D - Sala com painel de TV",
        date: "2025-06-15",
      },
      before: {
        url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400&h=300&fit=crop",
        caption: "Sala original do apartamento",
        date: "2025-07-01",
      },
      during: {
        url: "https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?w=400&h=300&fit=crop",
        caption: "Instalação de painel de TV e iluminação",
        date: "2025-09-06",
      },
    },
    {
      id: "room-6",
      name: "Área de Serviço",
      status: "pendente",
      render3D: {
        url: "https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=400&h=300&fit=crop",
        caption: "Projeto 3D - Área de serviço planejada",
        date: "2025-06-15",
      },
      before: {
        url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop",
        caption: "Área de serviço original",
        date: "2025-07-01",
      },
    },
  ],
};
