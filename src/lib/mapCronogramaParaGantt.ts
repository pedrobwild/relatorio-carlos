import { differenceInDays, format } from "date-fns";
import {
  getTodayLocal,
  parseLocalDate,
  type ActivityStatus,
} from "@/lib/activityStatus";

export type CronogramaStatusTabela = "CONCLUIDO" | "EM_ANDAMENTO" | "PENDENTE";

/**
 * Formato "exatamente como a tabela" (aceita chaves PT ou as chaves internas atuais).
 * A função não busca dados externos: recebe tudo por parâmetro.
 */
export interface CronogramaTabelaRow {
  id?: string;

  // Título
  titulo?: string;
  description?: string;

  // Datas previstas
  inicioPrevisto?: string;
  terminoPrevisto?: string;
  plannedStart?: string;
  plannedEnd?: string;

  // Datas reais
  inicioReal?: string | null;
  terminoReal?: string | null;
  actualStart?: string | null;
  actualEnd?: string | null;

  // Status da tabela (se existir). Se não existir, a própria tabela da UI já deriva isso via datas.
  status?: CronogramaStatusTabela;

  weight?: number;
  predecessorIds?: string[];
  baselineStart?: string | null;
  baselineEnd?: string | null;
}

export interface GanttTask {
  id: string;
  titulo: string;

  plannedStart: string;
  plannedEnd: string;

  /** Barra principal (conforme regras). */
  start: string;
  end: string;

  progress: number;
  status: ActivityStatus;
  statusTabela: CronogramaStatusTabela;
  delayDays: number;

  weight?: number;
  predecessorIds: string[];
  baselineStart?: string | null;
  baselineEnd?: string | null;
}

function normalizeDate(value?: string | null): string | null {
  const v = (value ?? "").toString().trim();
  return v.length ? v : null;
}

function pickPlannedStart(row: CronogramaTabelaRow): string {
  return row.inicioPrevisto ?? row.plannedStart ?? "";
}

function pickPlannedEnd(row: CronogramaTabelaRow): string {
  return row.terminoPrevisto ?? row.plannedEnd ?? "";
}

function pickActualStart(row: CronogramaTabelaRow): string | null {
  return normalizeDate(row.inicioReal ?? row.actualStart);
}

function pickActualEnd(row: CronogramaTabelaRow): string | null {
  return normalizeDate(row.terminoReal ?? row.actualEnd);
}

function pickTitulo(row: CronogramaTabelaRow): string {
  return (row.titulo ?? row.description ?? "(Sem título)").toString();
}

function computeStatusTabela(
  row: CronogramaTabelaRow,
  actualStart: string | null,
  actualEnd: string | null,
): CronogramaStatusTabela {
  // Se a tabela já fornece o status, ele é a fonte de verdade.
  if (row.status) return row.status;

  // Caso contrário, seguimos exatamente a mesma regra usada na tabela atual:
  // - terminou real => CONCLUIDO
  // - iniciou real => EM_ANDAMENTO
  // - senão => PENDENTE
  if (actualEnd) return "CONCLUIDO";
  if (actualStart) return "EM_ANDAMENTO";
  return "PENDENTE";
}

function clampProgress(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * FUNÇÃO ÚNICA E EXPLÍCITA (ENTREGÁVEL)
 *
 * Regras aplicadas:
 * - CONCLUIDO: start=inicioReal, end=terminoReal, progress=100
 * - EM_ANDAMENTO: start=inicioReal, end=HOJE, progress proporcional
 * - PENDENTE: start=inicioPrevisto, end=terminoPrevisto, progress=0
 * - ATRASADO (visual): hoje > terminoPrevisto e statusTabela != CONCLUIDO
 */
export function mapCronogramaParaGantt(
  atividades: CronogramaTabelaRow[],
  referenceDate: Date = getTodayLocal(),
): GanttTask[] {
  const hojeISO = format(referenceDate, "yyyy-MM-dd");

  return atividades.map((row, index) => {
    const plannedStart = pickPlannedStart(row);
    const plannedEnd = pickPlannedEnd(row);
    const actualStart = pickActualStart(row);
    const actualEnd = pickActualEnd(row);

    const statusTabela = computeStatusTabela(row, actualStart, actualEnd);

    // 1) Definir start/end/progress SEM misturar previsto com real.
    let start = plannedStart;
    let end = plannedEnd;
    let progress = 0;

    if (statusTabela === "CONCLUIDO") {
      // Obrigatório: usar datas REAIS
      if (!actualStart || !actualEnd) {
        // Não inferimos: apenas alertamos e degradamos para previsto (evita quebrar render).
        console.warn("[Gantt] Atividade CONCLUIDO sem datas reais completas:", {
          id: row.id,
          titulo: pickTitulo(row),
          actualStart,
          actualEnd,
        });
      } else {
        start = actualStart;
        end = actualEnd;
      }
      progress = 100;
    }

    if (statusTabela === "EM_ANDAMENTO") {
      if (!actualStart) {
        console.warn("[Gantt] Atividade EM_ANDAMENTO sem inicioReal:", {
          id: row.id,
          titulo: pickTitulo(row),
        });
      } else {
        start = actualStart;
        end = hojeISO; // PROIBIÇÃO: não usar terminoPrevisto como end

        // progresso = (hoje - inicioReal) / (terminoPrevisto - inicioReal)
        const inicioReal = parseLocalDate(actualStart);
        const terminoPrev = parseLocalDate(plannedEnd);
        const total = differenceInDays(terminoPrev, inicioReal) + 1;
        const elapsed = differenceInDays(referenceDate, inicioReal) + 1;
        progress = clampProgress(
          Math.round((elapsed / Math.max(total, 1)) * 100),
        );
        // Nunca 0% ou 100% enquanto estiver em andamento
        progress = Math.min(99, Math.max(1, progress));
      }
    }

    if (statusTabela === "PENDENTE") {
      start = plannedStart;
      end = plannedEnd;
      progress = 0;
    }

    // 2) Atraso (visual) conforme regra: hoje > terminoPrevisto e statusTabela != CONCLUIDO
    let status: ActivityStatus;
    let delayDays = 0;
    const terminoPrevDate = parseLocalDate(plannedEnd);
    if (statusTabela !== "CONCLUIDO" && referenceDate > terminoPrevDate) {
      status = "delayed";
      delayDays = differenceInDays(referenceDate, terminoPrevDate);
    } else {
      status =
        statusTabela === "CONCLUIDO"
          ? "completed"
          : statusTabela === "EM_ANDAMENTO"
            ? "in-progress"
            : "pending";
    }

    const id = row.id ?? `row-${index}`;

    return {
      id,
      titulo: pickTitulo(row),
      plannedStart,
      plannedEnd,
      start,
      end,
      progress,
      status,
      statusTabela,
      delayDays,
      weight: row.weight,
      predecessorIds: row.predecessorIds ?? [],
      baselineStart: row.baselineStart,
      baselineEnd: row.baselineEnd,
    };
  });
}
