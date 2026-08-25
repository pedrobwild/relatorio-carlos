/**
 * Comparação entre o estado local do editor e o estado do servidor.
 *
 * Usado na verificação de carregamento: antes de o autosave começar a
 * gravar, comparamos o que está na tela com o que está no banco. Se houver
 * divergência (ex.: cache local defasado, outra pessoa salvou, aba antiga),
 * o editor avisa e deixa a pessoa escolher — em vez de sobrescrever.
 */

import type { WeeklyReportData, GalleryPhoto } from "@/types/weeklyReport";

/** URLs assinadas mudam a cada refresh; o que identifica a foto é id/path. */
function normalizePhoto(photo: GalleryPhoto) {
  const url = photo.url?.split("?")[0] ?? "";
  return {
    id: photo.id,
    path: photo.path ?? (url.startsWith("blob:") ? "" : url),
    caption: photo.caption?.trim() ?? "",
    area: photo.area?.trim() ?? "",
    date: photo.date ?? "",
    category: photo.category ?? "",
  };
}

function stableList(items: unknown[] | undefined): string {
  return JSON.stringify(items ?? []);
}

export interface ReportDivergence {
  /** Rótulos das seções divergentes, prontos para exibição. */
  sections: string[];
  hasDivergence: boolean;
}

export function diffWeeklyReportData(
  local: WeeklyReportData | null | undefined,
  server: WeeklyReportData | null | undefined,
): ReportDivergence {
  const sections: string[] = [];
  if (!local || !server) return { sections, hasDivergence: false };

  if ((local.executiveSummary ?? "").trim() !== (server.executiveSummary ?? "").trim()) {
    sections.push("Resumo executivo");
  }
  if (stableList(local.lookaheadTasks) !== stableList(server.lookaheadTasks)) {
    sections.push("Próximas atividades");
  }
  if (stableList(local.risksAndIssues) !== stableList(server.risksAndIssues)) {
    sections.push("Riscos e problemas");
  }
  if (stableList(local.clientDecisions) !== stableList(server.clientDecisions)) {
    sections.push("Decisões do cliente");
  }
  if (stableList(local.incidents) !== stableList(server.incidents)) {
    sections.push("Ocorrências");
  }
  if (
    stableList((local.gallery ?? []).map(normalizePhoto)) !==
    stableList((server.gallery ?? []).map(normalizePhoto))
  ) {
    sections.push("Fotos e vídeos");
  }

  return { sections, hasDivergence: sections.length > 0 };
}
