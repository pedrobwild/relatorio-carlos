/**
 * Rascunho do texto do relatório semanal do cliente, montado no fechamento
 * da semana (Fase 6).
 *
 * Sai do que a equipe já registrou (Feito / Não feito de cada dia e o que está
 * marcado para a semana seguinte), agrupado por etapa: "O que foi feito" e
 * "Próxima semana". É macro, como o cliente deve ver: SEM nomes de pessoas,
 * SEM custos, SEM motivos internos.
 *
 * O texto é só para copiar. Ele NÃO é gravado em `weekly_reports`: qualquer
 * linha ali fica visível ao cliente sozinha (o banco preenche `available_at`
 * com o dia seguinte ao fim da semana, 20h). Quem publica é o relatório
 * semanal, revisado por gente.
 *
 * Regras puras, sem React nem Supabase.
 */
import type { OpsActivityView, OpsAssignment, OpsStageOption } from "@/infra/repositories/ops.repository";
import { shiftISODate } from "@/lib/hojeDia";
import { weekLabel } from "@/lib/semanaPlan";

export type ReportActivity = Pick<OpsActivityView, "id" | "title" | "stage_name"> &
  Partial<Pick<OpsActivityView, "status" | "stage_sort_order" | "sort_order">>;
type Activity = ReportActivity;
type Assignment = Pick<OpsAssignment, "activity_id" | "work_date" | "outcome">;
type Stage = Pick<OpsStageOption, "description" | "sort_order" | "planned_start" | "planned_end" | "actual_end">;

export interface ReportStageBlock {
  stage: string;
  /** Itens já escritos para o cliente ("Massa corrida (concluída)"). Vazio = só a etapa. */
  items: string[];
}

export interface WeekReportDraft {
  done: ReportStageBlock[];
  next: ReportStageBlock[];
  /** A próxima semana veio das etapas previstas no cronograma (nada marcado ainda). */
  nextFromSchedule: boolean;
  text: string;
}

const NO_STAGE = "Outros serviços";
const FINISHED = new Set(["concluida", "aprovada"]);

const inRange = (iso: string, from: string, to: string) => iso >= from && iso <= to;

function groupByStage(acts: ReadonlyArray<Activity>, label: (a: Activity) => string): ReportStageBlock[] {
  const sorted = [...acts].sort(
    (a, b) =>
      (a.stage_sort_order ?? Number.MAX_SAFE_INTEGER) - (b.stage_sort_order ?? Number.MAX_SAFE_INTEGER) ||
      (a.stage_name ?? NO_STAGE).localeCompare(b.stage_name ?? NO_STAGE, "pt-BR") ||
      (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
      (a.title ?? "").localeCompare(b.title ?? "", "pt-BR"),
  );
  const blocks: ReportStageBlock[] = [];
  for (const a of sorted) {
    const stage = a.stage_name?.trim() || NO_STAGE;
    let block = blocks.find((b) => b.stage === stage);
    if (!block) {
      block = { stage, items: [] };
      blocks.push(block);
    }
    const item = label(a);
    if (!block.items.includes(item)) block.items.push(item);
  }
  return blocks;
}

const blockLine = (b: ReportStageBlock) => (b.items.length > 0 ? `• ${b.stage}: ${b.items.join("; ")}` : `• ${b.stage}`);

export function buildWeekReportDraft(input: {
  monday: string;
  /** Dias marcados na semana que está fechando (seg–dom). */
  assignments: ReadonlyArray<Assignment>;
  /** Dias marcados na semana seguinte (seg–dom). */
  nextAssignments: ReadonlyArray<Assignment>;
  activities: ReadonlyArray<Activity>;
  /** Etapas do cronograma interno, para a próxima semana quando nada foi marcado. */
  stages: ReadonlyArray<Stage>;
}): WeekReportDraft {
  const { monday } = input;
  const sunday = shiftISODate(monday, 6);
  const nextMonday = shiftISODate(monday, 7);
  const nextSunday = shiftISODate(monday, 13);
  const byId = new Map(input.activities.map((a) => [a.id, a]));

  // O que foi feito: atividade com ao menos um dia "Feito" na semana.
  const doneIds = new Set(
    input.assignments
      .filter((a) => a.outcome === "feito" && inRange(a.work_date, monday, sunday))
      .map((a) => a.activity_id),
  );
  const doneActs = [...doneIds].flatMap((id) => (byId.has(id) ? [byId.get(id) as Activity] : []));
  const done = groupByStage(doneActs, (a) => {
    const title = a.title?.trim() || "Serviço";
    return a.status && FINISHED.has(a.status) ? `${title} (concluída)` : title;
  });

  // Próxima semana: o que já está marcado; senão, as etapas previstas.
  const nextIds = new Set(
    input.nextAssignments.filter((a) => inRange(a.work_date, nextMonday, nextSunday)).map((a) => a.activity_id),
  );
  const nextActs = [...nextIds].flatMap((id) => (byId.has(id) ? [byId.get(id) as Activity] : []));
  let next = groupByStage(nextActs, (a) => a.title?.trim() || "Serviço");
  let nextFromSchedule = false;
  if (next.length === 0) {
    const nextFriday = shiftISODate(nextMonday, 4);
    next = [...input.stages]
      .filter((s) => !s.actual_end && s.planned_start <= nextFriday && s.planned_end >= nextMonday)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => ({ stage: s.description, items: [] }));
    nextFromSchedule = next.length > 0;
  }

  const lines = [
    `Resumo da semana de ${weekLabel(monday)}`,
    "",
    "O que foi feito",
    ...(done.length > 0 ? done.map(blockLine) : ["• Nenhum serviço registrado como feito nesta semana."]),
    "",
    `Próxima semana (${weekLabel(nextMonday)})`,
    ...(next.length > 0 ? next.map(blockLine) : ["• Ainda sem serviços marcados."]),
  ];

  return { done, next, nextFromSchedule, text: lines.join("\n") };
}
