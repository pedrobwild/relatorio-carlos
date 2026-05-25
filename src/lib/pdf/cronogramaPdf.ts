/**
 * cronogramaPdf — exporta o Cronograma de Obra em PDF (A4 paisagem).
 *
 * Dois layouts:
 *   1. Obra NÃO iniciada (nenhuma atividade com `actual_start`):
 *      tabela enxuta sem colunas de execução real.
 *   2. Obra EM andamento: tabela completa com colunas de execução,
 *      progresso e status calculado.
 *
 * Carrega `jspdf` + `jspdf-autotable` dinamicamente (lazy import) para
 * manter o bundle inicial leve.
 */

import { formatInTimeZone } from "date-fns-tz";
import { ptBR } from "date-fns/locale";
import type { ProjectActivity } from "@/hooks/useProjectActivities";
import { getActivityState, isProjectNotStarted } from "@/lib/scheduleState";
import { countBusinessDaysInclusive } from "@/lib/businessDays";
import { parseLocalDate, computeEffectiveStatus } from "@/lib/activityStatus";

const SP_TZ = "America/Sao_Paulo";

const HEADER_FILL: [number, number, number] = [15, 23, 42]; // slate-900
const HEADER_TEXT: [number, number, number] = [255, 255, 255];
const ZEBRA_FILL: [number, number, number] = [245, 245, 247];
const DELAYED_FILL: [number, number, number] = [254, 226, 226]; // bg-destructive/10
const ETAPA_FILL: [number, number, number] = [226, 232, 240]; // slate-200

export interface CronogramaPdfProject {
  id?: string;
  name: string;
  customer_name?: string | null;
  address?: string | null;
  endereco_completo?: string | null;
  bairro?: string | null;
  cidade?: string | null;
}

export interface CronogramaPdfOptions {
  /** Date used to compute statuses (default: now). Useful for tests. */
  now?: Date;
  /** When provided, overrides the auto-generated filename. */
  fileName?: string;
}

export class CronogramaPdfEmptyError extends Error {
  constructor() {
    super("Não há atividades cadastradas para exportar.");
    this.name = "CronogramaPdfEmptyError";
  }
}

/** Slug compatível com nomes de arquivo: minúsculo, sem acento, hífens. */
export function slugifyForFilename(input: string | null | undefined): string {
  const value = (input ?? "").toString();
  const normalized = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  const slug = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "obra";
}

function formatAddress(project: CronogramaPdfProject): string | null {
  const direct = project.endereco_completo?.trim() || project.address?.trim();
  if (direct) {
    const extras = [project.bairro, project.cidade].filter(Boolean).join(" — ");
    return extras ? `${direct} · ${extras}` : direct;
  }
  const fallback = [project.bairro, project.cidade].filter(Boolean).join(" — ");
  return fallback || null;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return formatInTimeZone(parseLocalDate(value), SP_TZ, "dd/MM/yyyy", {
    locale: ptBR,
  });
}

function durationBusinessDays(activity: ProjectActivity): number {
  if (!activity.planned_start || !activity.planned_end) return 0;
  return countBusinessDaysInclusive(
    parseLocalDate(activity.planned_start),
    parseLocalDate(activity.planned_end),
  );
}

function sortActivities(activities: ProjectActivity[]): ProjectActivity[] {
  return [...activities].sort((a, b) => {
    const sa = a.planned_start ?? "";
    const sb = b.planned_start ?? "";
    if (sa === sb) return a.sort_order - b.sort_order;
    return sa < sb ? -1 : 1;
  });
}

interface GroupedByEtapa {
  etapa: string | null;
  activities: ProjectActivity[];
}

function groupByEtapa(activities: ProjectActivity[]): GroupedByEtapa[] {
  const groups: GroupedByEtapa[] = [];
  let currentEtapa: string | null | undefined;
  for (const act of activities) {
    const etapa = act.etapa?.trim() || null;
    if (etapa !== currentEtapa) {
      groups.push({ etapa, activities: [act] });
      currentEtapa = etapa;
    } else {
      groups[groups.length - 1].activities.push(act);
    }
  }
  return groups;
}

interface BuildResult {
  doc: import("jspdf").jsPDF;
  fileName: string;
}

/**
 * Gera o PDF do cronograma e retorna o doc + filename.
 * Lança `CronogramaPdfEmptyError` quando não há atividades.
 */
export async function generateCronogramaPdf(
  project: CronogramaPdfProject,
  activities: ProjectActivity[],
  options: CronogramaPdfOptions = {},
): Promise<BuildResult> {
  if (!activities || activities.length === 0) {
    throw new CronogramaPdfEmptyError();
  }

  const [{ default: jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = (
    autoTableMod as { default: typeof import("jspdf-autotable").default }
  ).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 12;

  const sorted = sortActivities(activities);
  const notStarted = isProjectNotStarted(activities);
  const now = options.now ?? new Date();

  const plannedStarts = sorted
    .map((a) => a.planned_start)
    .filter((d): d is string => !!d);
  const plannedEnds = sorted
    .map((a) => a.planned_end)
    .filter((d): d is string => !!d);
  const minStart = plannedStarts.length
    ? plannedStarts.reduce((min, d) => (d < min ? d : min))
    : null;
  const maxEnd = plannedEnds.length
    ? plannedEnds.reduce((max, d) => (d > max ? d : max))
    : null;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text("Cronograma de Obra", marginX, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(project.name || "—", marginX, 22);

  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);

  const infoLines: string[] = [];
  if (project.customer_name) {
    infoLines.push(`Cliente: ${project.customer_name}`);
  }
  const address = formatAddress(project);
  if (address) {
    infoLines.push(`Endereço: ${address}`);
  }
  const emittedAt = formatInTimeZone(now, SP_TZ, "dd/MM/yyyy HH:mm", {
    locale: ptBR,
  });
  infoLines.push(`Emitido em: ${emittedAt}`);
  infoLines.push(`Status geral: ${notStarted ? "Não iniciada" : "Em andamento"}`);
  if (minStart) infoLines.push(`Início previsto: ${formatDate(minStart)}`);
  if (maxEnd) infoLines.push(`Término previsto: ${formatDate(maxEnd)}`);

  let infoY = 28;
  for (const line of infoLines) {
    doc.text(line, marginX, infoY);
    infoY += 4.5;
  }

  let startY = infoY + 4;

  if (!notStarted) {
    const stats = computeProjectStats(sorted, now);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `Progresso geral: ${stats.weightedProgress.toFixed(1)}%`,
      marginX,
      startY,
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(
      `Concluídas: ${stats.completed}  ·  Em andamento: ${stats.inProgress}  ·  Atrasadas: ${stats.delayed}  ·  Não iniciadas: ${stats.notStarted}`,
      marginX,
      startY + 5,
    );
    startY += 12;
  }

  const groups = groupByEtapa(sorted);

  if (notStarted) {
    buildNotStartedTable(doc, autoTable, groups, startY, marginX);
  } else {
    buildInProgressTable(doc, autoTable, groups, startY, marginX, now);
  }

  const totalPages = doc.getNumberOfPages();
  const footerNote = notStarted
    ? "Cronograma preliminar — obra ainda não iniciada."
    : "";
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "normal");
    const footerLeft = `Portal BWild · ${project.name || "Obra"}`;
    const footerRight = `Página ${i} de ${totalPages}`;
    doc.text(footerLeft, marginX, pageHeight - 6);
    doc.text(footerRight, pageWidth - marginX, pageHeight - 6, {
      align: "right",
    });
    if (footerNote && i === totalPages) {
      doc.setFont("helvetica", "italic");
      doc.text(footerNote, pageWidth / 2, pageHeight - 6, { align: "center" });
    }
  }

  const dateStamp = formatInTimeZone(now, SP_TZ, "yyyy-MM-dd");
  const fileName =
    options.fileName ??
    `cronograma_${slugifyForFilename(project.name)}_${dateStamp}.pdf`;

  return { doc, fileName };
}

function computeProjectStats(activities: ProjectActivity[], now: Date) {
  let completed = 0;
  let inProgress = 0;
  let delayed = 0;
  let notStartedCount = 0;
  let totalWeight = 0;
  let weightedProgress = 0;

  for (const act of activities) {
    const status = computeEffectiveStatus(
      {
        plannedStart: act.planned_start,
        plannedEnd: act.planned_end,
        actualStart: act.actual_start,
        actualEnd: act.actual_end,
      },
      now,
    );
    const weight = Number.isFinite(act.weight) ? act.weight : 0;
    totalWeight += weight;
    weightedProgress += (weight * status.progress) / 100;

    switch (status.status) {
      case "completed":
        completed++;
        break;
      case "in-progress":
        inProgress++;
        break;
      case "delayed":
        delayed++;
        break;
      default:
        notStartedCount++;
    }
  }

  const finalProgress =
    totalWeight > 0 ? (weightedProgress / totalWeight) * 100 : 0;

  return {
    completed,
    inProgress,
    delayed,
    notStarted: notStartedCount,
    weightedProgress: finalProgress,
  };
}

type AutoTableFn = typeof import("jspdf-autotable").default;

function buildEtapaRow(label: string, columns: number) {
  return [
    {
      content: label,
      colSpan: columns,
      styles: {
        fontStyle: "bold" as const,
        fillColor: ETAPA_FILL,
        textColor: [15, 23, 42] as [number, number, number],
        halign: "left" as const,
      },
    },
  ];
}

function buildNotStartedTable(
  doc: import("jspdf").jsPDF,
  autoTable: AutoTableFn,
  groups: GroupedByEtapa[],
  startY: number,
  marginX: number,
) {
  const head = [
    [
      "#",
      "Atividade",
      "Início Previsto",
      "Término Previsto",
      "Duração (dias úteis)",
      "Peso (%)",
    ],
  ];
  const body: import("jspdf-autotable").RowInput[] = [];

  let counter = 0;
  for (const group of groups) {
    if (group.etapa) {
      body.push(buildEtapaRow(`Etapa: ${group.etapa}`, head[0].length));
    }
    for (const act of group.activities) {
      counter++;
      body.push([
        counter,
        act.description,
        formatDate(act.planned_start),
        formatDate(act.planned_end),
        durationBusinessDays(act).toString(),
        Number.isFinite(act.weight) ? act.weight.toFixed(1) : "0.0",
      ]);
    }
  }

  autoTable(doc, {
    head,
    body,
    startY,
    margin: { left: marginX, right: marginX, bottom: 12 },
    styles: {
      fontSize: 9,
      cellPadding: 2.2,
      overflow: "linebreak",
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: HEADER_FILL,
      textColor: HEADER_TEXT,
      fontStyle: "bold",
      halign: "center",
    },
    alternateRowStyles: { fillColor: ZEBRA_FILL },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { cellWidth: "auto" },
      2: { halign: "center", cellWidth: 35 },
      3: { halign: "center", cellWidth: 35 },
      4: { halign: "center", cellWidth: 35 },
      5: { halign: "right", cellWidth: 22 },
    },
    rowPageBreak: "avoid",
    pageBreak: "auto",
  });
}

function buildInProgressTable(
  doc: import("jspdf").jsPDF,
  autoTable: AutoTableFn,
  groups: GroupedByEtapa[],
  startY: number,
  marginX: number,
  now: Date,
) {
  const head = [
    [
      "#",
      "Etapa",
      "Atividade",
      "Início Prev.",
      "Término Prev.",
      "Início Real",
      "Término Real",
      "Progresso",
      "Status",
    ],
  ];
  const body: import("jspdf-autotable").RowInput[] = [];
  const delayedRowIndexes = new Set<number>();

  let counter = 0;
  let rowIdx = 0;
  for (const group of groups) {
    if (group.etapa) {
      body.push(buildEtapaRow(`Etapa: ${group.etapa}`, head[0].length));
      rowIdx++;
    }
    for (const act of group.activities) {
      counter++;
      const state = getActivityState(
        {
          plannedStart: act.planned_start,
          plannedEnd: act.planned_end,
          actualStart: act.actual_start,
          actualEnd: act.actual_end,
        },
        now,
      );
      const status = computeEffectiveStatus(
        {
          plannedStart: act.planned_start,
          plannedEnd: act.planned_end,
          actualStart: act.actual_start,
          actualEnd: act.actual_end,
        },
        now,
      );

      if (state.state === "delayed") {
        delayedRowIndexes.add(rowIdx);
      }

      body.push([
        counter,
        group.etapa ?? "—",
        act.description,
        formatDate(act.planned_start),
        formatDate(act.planned_end),
        formatDate(act.actual_start),
        formatDate(act.actual_end),
        `${status.progress}%`,
        state.label,
      ]);
      rowIdx++;
    }
  }

  autoTable(doc, {
    head,
    body,
    startY,
    margin: { left: marginX, right: marginX, bottom: 12 },
    styles: {
      fontSize: 9,
      cellPadding: 2,
      overflow: "linebreak",
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: HEADER_FILL,
      textColor: HEADER_TEXT,
      fontStyle: "bold",
      halign: "center",
    },
    alternateRowStyles: { fillColor: ZEBRA_FILL },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { cellWidth: 32 },
      2: { cellWidth: "auto" },
      3: { halign: "center", cellWidth: 26 },
      4: { halign: "center", cellWidth: 26 },
      5: { halign: "center", cellWidth: 26 },
      6: { halign: "center", cellWidth: 26 },
      7: { halign: "right", cellWidth: 22 },
      8: { halign: "center", cellWidth: 26 },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      if (delayedRowIndexes.has(data.row.index)) {
        data.cell.styles.fillColor = DELAYED_FILL;
        data.cell.styles.textColor = [127, 29, 29];
      }
    },
    rowPageBreak: "avoid",
    pageBreak: "auto",
  });
}
