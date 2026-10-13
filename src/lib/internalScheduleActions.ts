/**
 * Ações rápidas de data real do Calendário e do Lookahead ("Iniciar",
 * "Concluir"). Gravam no item interno e, para item do cliente, também na
 * atividade do cliente — cada lado calculado da PRÓPRIA linha: um lado que
 * já tem a data nunca é sobrescrito (ex.: o cliente já iniciado em 30/10
 * continua com 30/10 mesmo que o interno seja iniciado hoje).
 */
import type { MirrorChange } from "@/hooks/useInternalSchedule";

/** "Iniciar" / "Iniciou hoje": marca o início só em quem ainda não tem. */
export function startTodayChange(today: string): MirrorChange {
  return { actual_start: (row) => (row.actual_start ? undefined : today) };
}

/**
 * "Concluir": marca o término só em quem ainda não tem; sem início, usa o
 * padrão de cada tela (Calendário: início previsto da linha; Lookahead: hoje).
 */
export function finishTodayChange(today: string, startFallback: "planned_start" | "today"): MirrorChange {
  return {
    actual_end: (row) => (row.actual_end ? undefined : today),
    actual_start: (row) =>
      row.actual_start ? undefined : startFallback === "planned_start" ? row.planned_start : today,
  };
}
