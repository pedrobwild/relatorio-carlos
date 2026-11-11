/**
 * Situação do relatório da semana corrente, para o hub da obra e a gaveta
 * Registrar. Só afirma o que os dados já carregados permitem:
 *
 * - "rascunho": existe relatório salvo, com conteúdo, para a semana de hoje;
 * - "sem_relatorio": a obra está em andamento e a semana de hoje não tem nada;
 * - "neutro": não dá para saber (carregando, erro, obra fora do período).
 *
 * Não existe "enviado": o relatório não tem esse estado no banco, ele fica
 * visível ao cliente sozinho depois do fim da semana.
 */
import type { WeeklyReportData } from "@/types/weeklyReport";

export type RelatorioSemanaStatus =
  | { kind: "neutro" }
  | { kind: "sem_relatorio" }
  | { kind: "rascunho"; fotos: number };

type ReportLike = Partial<
  Pick<
    WeeklyReportData,
    | "periodStart"
    | "periodEnd"
    | "executiveSummary"
    | "lookaheadTasks"
    | "risksAndIssues"
    | "clientDecisions"
    | "incidents"
    | "gallery"
  >
>;

const ISO = /^\d{4}-\d{2}-\d{2}/;
const day = (v: string | null | undefined) => (v && ISO.test(v) ? v.slice(0, 10) : null);

function hasContent(r: ReportLike): boolean {
  return (
    (r.executiveSummary?.trim().length ?? 0) > 0 ||
    (r.lookaheadTasks?.length ?? 0) > 0 ||
    (r.risksAndIssues?.length ?? 0) > 0 ||
    (r.clientDecisions?.length ?? 0) > 0 ||
    (r.incidents?.length ?? 0) > 0 ||
    (r.gallery?.length ?? 0) > 0
  );
}

export function relatorioSemanaStatus(input: {
  /** Relatórios salvos da obra. */
  reports: Iterable<ReportLike | null | undefined>;
  /** false enquanto carrega ou se a leitura falhou. */
  loaded: boolean;
  hoje: string;
  /** Início e fim previstos da obra (yyyy-mm-dd). */
  obra: { inicio?: string | null; fim?: string | null };
}): RelatorioSemanaStatus {
  if (!input.loaded) return { kind: "neutro" };
  const { hoje } = input;
  for (const r of input.reports) {
    if (!r) continue;
    const start = day(r.periodStart);
    const end = day(r.periodEnd);
    if (!start || !end || start > hoje || hoje > end) continue;
    if (hasContent(r)) return { kind: "rascunho", fotos: r.gallery?.length ?? 0 };
  }
  const inicio = day(input.obra.inicio);
  const fim = day(input.obra.fim);
  if (inicio && fim && inicio <= hoje && hoje <= fim) return { kind: "sem_relatorio" };
  return { kind: "neutro" };
}
