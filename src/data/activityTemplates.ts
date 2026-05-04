/**
 * Predefined activity templates for common project types.
 * Used in ImportScheduleModal to quickly populate a cronograma.
 */

export interface ActivityTemplate {
  description: string;
  /** Duration in business days */
  durationDays: number;
  /** Weight percentage */
  weight: number;
}

export interface ActivityTemplateSet {
  id: string;
  name: string;
  emoji: string;
  description: string;
  activities: ActivityTemplate[];
}

export const activityTemplateSets: ActivityTemplateSet[] = [
  {
    id: "reforma-studio",
    name: "Reforma Studio",
    emoji: "🏠",
    description:
      "Template padrão para reforma de studios e apartamentos compactos (45-60 dias).",
    activities: [
      { description: "Mobilização e proteção", durationDays: 3, weight: 3 },
      { description: "Demolição e remoção", durationDays: 5, weight: 5 },
      { description: "Instalações elétricas", durationDays: 7, weight: 10 },
      { description: "Instalações hidráulicas", durationDays: 7, weight: 10 },
      { description: "Alvenaria e dry-wall", durationDays: 5, weight: 8 },
      { description: "Impermeabilização", durationDays: 3, weight: 5 },
      { description: "Revestimento de piso", durationDays: 5, weight: 10 },
      { description: "Revestimento de parede", durationDays: 5, weight: 8 },
      { description: "Forro de gesso", durationDays: 4, weight: 5 },
      { description: "Pintura", durationDays: 5, weight: 8 },
      { description: "Louças e metais", durationDays: 3, weight: 5 },
      { description: "Marcenaria", durationDays: 5, weight: 12 },
      { description: "Limpeza e desmobilização", durationDays: 3, weight: 5 },
      { description: "Vistoria final e entrega", durationDays: 2, weight: 6 },
    ],
  },
  {
    id: "projeto-completo",
    name: "Projeto Completo",
    emoji: "📐",
    description:
      "Template para fase de projeto (3D + Executivo + Aprovações, 30-45 dias).",
    activities: [
      { description: "Briefing e levantamento", durationDays: 3, weight: 8 },
      {
        description: "Estudo preliminar (layout)",
        durationDays: 5,
        weight: 10,
      },
      { description: "Aprovação do layout", durationDays: 3, weight: 5 },
      { description: "Projeto 3D – Modelagem", durationDays: 7, weight: 15 },
      { description: "Projeto 3D – Renders", durationDays: 5, weight: 10 },
      { description: "Aprovação do Projeto 3D", durationDays: 3, weight: 5 },
      {
        description: "Projeto Executivo – Plantas",
        durationDays: 7,
        weight: 15,
      },
      {
        description: "Projeto Executivo – Detalhamentos",
        durationDays: 5,
        weight: 10,
      },
      { description: "Revisão e ajustes", durationDays: 3, weight: 5 },
      {
        description: "Aprovação e assinatura do Executivo",
        durationDays: 3,
        weight: 7,
      },
      { description: "Emissão de ART/RRT", durationDays: 2, weight: 5 },
      { description: "Liberação para obra", durationDays: 2, weight: 5 },
    ],
  },
  {
    id: "reforma-completa",
    name: "Reforma Completa",
    emoji: "🔨",
    description:
      "Template para reformas maiores com todas as etapas (90-120 dias).",
    activities: [
      {
        description: "Mobilização e proteção de áreas comuns",
        durationDays: 3,
        weight: 2,
      },
      { description: "Demolição geral", durationDays: 7, weight: 4 },
      { description: "Remoção de entulho", durationDays: 3, weight: 2 },
      {
        description: "Instalações elétricas – infraestrutura",
        durationDays: 10,
        weight: 7,
      },
      {
        description: "Instalações hidráulicas – água fria e quente",
        durationDays: 8,
        weight: 6,
      },
      { description: "Instalações de gás", durationDays: 3, weight: 3 },
      {
        description: "Ar-condicionado – infraestrutura",
        durationDays: 5,
        weight: 4,
      },
      { description: "Alvenaria e divisórias", durationDays: 7, weight: 5 },
      {
        description: "Impermeabilização de áreas molhadas",
        durationDays: 5,
        weight: 4,
      },
      { description: "Contrapiso e regularização", durationDays: 5, weight: 4 },
      {
        description: "Revestimento cerâmico – piso",
        durationDays: 8,
        weight: 6,
      },
      {
        description: "Revestimento cerâmico – parede",
        durationDays: 7,
        weight: 5,
      },
      {
        description: "Forro de gesso e iluminação",
        durationDays: 7,
        weight: 5,
      },
      {
        description: "Instalações elétricas – acabamento",
        durationDays: 5,
        weight: 4,
      },
      {
        description: "Pintura – massa e lixamento",
        durationDays: 5,
        weight: 4,
      },
      { description: "Pintura – acabamento", durationDays: 5, weight: 4 },
      { description: "Portas e ferragens", durationDays: 4, weight: 3 },
      {
        description: "Louças, metais e acessórios",
        durationDays: 4,
        weight: 4,
      },
      { description: "Marcenaria – instalação", durationDays: 7, weight: 8 },
      { description: "Vidraçaria e espelhos", durationDays: 3, weight: 3 },
      {
        description: "Ar-condicionado – instalação",
        durationDays: 3,
        weight: 3,
      },
      { description: "Limpeza fina", durationDays: 3, weight: 3 },
      { description: "Vistoria e punch-list", durationDays: 3, weight: 3 },
      { description: "Entrega e desmobilização", durationDays: 2, weight: 4 },
    ],
  },
];

/**
 * Convert a template set into ActivityFormData[] with calculated dates
 * starting from a given date.
 */
export function generateActivitiesFromTemplate(
  template: ActivityTemplateSet,
  startDate: Date = new Date(),
): {
  id: string;
  description: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string;
  actualEnd: string;
  weight: string;
  predecessorIds: string[];
}[] {
  let currentDate = new Date(startDate);

  // Skip to next weekday if starting on weekend
  while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return template.activities.map((act) => {
    const start = new Date(currentDate);

    // Calculate end date adding business days
    let remaining = act.durationDays - 1;
    const end = new Date(start);
    while (remaining > 0) {
      end.setDate(end.getDate() + 1);
      if (end.getDay() !== 0 && end.getDay() !== 6) {
        remaining--;
      }
    }

    // Next activity starts the next business day after this ends
    currentDate = new Date(end);
    currentDate.setDate(currentDate.getDate() + 1);
    while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const fmt = (d: Date) => d.toISOString().split("T")[0];

    return {
      id: crypto.randomUUID(),
      description: act.description,
      plannedStart: fmt(start),
      plannedEnd: fmt(end),
      actualStart: "",
      actualEnd: "",
      weight: String(act.weight),
      predecessorIds: [],
    };
  });
}
