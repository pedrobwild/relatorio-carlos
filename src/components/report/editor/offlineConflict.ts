/**
 * Resolução de conflito após edição offline.
 *
 * Cenário: a pessoa editou o relatório sem conexão (as alterações ficaram na
 * fila local) e, nesse meio tempo, alguém salvou uma versão nova no servidor.
 * Antes de enviar a fila, comparamos três estados:
 *
 *   base   → o que estava salvo quando a conexão caiu
 *   local  → o que está na tela agora (edições offline)
 *   server → o que está no servidor agora
 *
 * Quando as duas partes mexeram em seções diferentes, dá para juntar tudo
 * automaticamente. Só pedimos decisão humana quando a MESMA seção mudou dos
 * dois lados.
 */

import type { WeeklyReportData } from "@/types/weeklyReport";
import { diffWeeklyReportData } from "./reportDiff";

/** Rótulo exibido → campo correspondente em WeeklyReportData. */
export const SECTION_FIELDS: Record<string, keyof WeeklyReportData> = {
  "Resumo executivo": "executiveSummary",
  "Próximas atividades": "lookaheadTasks",
  "Riscos e problemas": "risksAndIssues",
  "Decisões do cliente": "clientDecisions",
  Ocorrências: "incidents",
  "Fotos e vídeos": "gallery",
};

export type OfflineConflictKind =
  | "no-change" // nada mudou dos dois lados
  | "auto-local" // só o dispositivo mudou → envia local
  | "auto-server" // só o servidor mudou → adota o servidor
  | "auto-merged" // mudanças em seções diferentes → junta as duas
  | "conflict"; // mesma seção mudou dos dois lados → pessoa decide

export interface OfflineConflictResolution {
  kind: OfflineConflictKind;
  /** Seções alteradas no dispositivo (offline). */
  localSections: string[];
  /** Seções alteradas no servidor durante o período offline. */
  serverSections: string[];
  /** Seções alteradas dos dois lados. */
  conflictingSections: string[];
  /**
   * Resultado sugerido: mantém o que foi editado no dispositivo e traz do
   * servidor as seções que só ele mudou.
   */
  merged: WeeklyReportData;
}

function applySections(
  target: WeeklyReportData,
  source: WeeklyReportData,
  sections: string[],
): WeeklyReportData {
  let result = target;
  for (const section of sections) {
    const field = SECTION_FIELDS[section];
    if (!field) continue;
    result = { ...result, [field]: source[field] } as WeeklyReportData;
  }
  return result;
}

export function resolveOfflineConflict({
  base,
  local,
  server,
}: {
  base: WeeklyReportData | null | undefined;
  local: WeeklyReportData;
  server: WeeklyReportData | null | undefined;
}): OfflineConflictResolution {
  if (!server) {
    return {
      kind: "auto-local",
      localSections: [],
      serverSections: [],
      conflictingSections: [],
      merged: local,
    };
  }

  const reference = base ?? server;
  const serverSections = diffWeeklyReportData(reference, server).sections;
  const localSections = diffWeeklyReportData(reference, local).sections;
  const conflictingSections = serverSections.filter((s) =>
    localSections.includes(s),
  );
  const serverOnly = serverSections.filter((s) => !localSections.includes(s));
  const merged = applySections(local, server, serverOnly);

  if (serverSections.length === 0 && localSections.length === 0) {
    return {
      kind: "no-change",
      localSections,
      serverSections,
      conflictingSections,
      merged: local,
    };
  }
  if (serverSections.length === 0) {
    return {
      kind: "auto-local",
      localSections,
      serverSections,
      conflictingSections,
      merged: local,
    };
  }
  if (localSections.length === 0) {
    return {
      kind: "auto-server",
      localSections,
      serverSections,
      conflictingSections,
      merged: server,
    };
  }
  if (conflictingSections.length === 0) {
    return {
      kind: "auto-merged",
      localSections,
      serverSections,
      conflictingSections,
      merged,
    };
  }
  return {
    kind: "conflict",
    localSections,
    serverSections,
    conflictingSections,
    merged,
  };
}
