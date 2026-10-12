/**
 * Regras puras do "Resumo da semana" (diretoria).
 *
 * Uma leitura curta de todas as obras em execução e de quanto cada gestor de
 * obra está usando o planejamento semanal. Nada é recalculado de outro
 * jeito: risco, folga, multa e alertas vêm das linhas do Painel
 * (`buildObraRow`); o PPC usa `ppcOf` e os motivos usam os rótulos de
 * `opsLabels`. Datas sempre em yyyy-mm-dd no fuso local (São Paulo), pelos
 * helpers de `hojeDia` / `semanaPlan`.
 *
 * Definições (as mesmas que aparecem na tela):
 * - Semana que passou: a última semana inteira (segunda a domingo) que já
 *   terminou. Hoje segunda 12/10 → 5 a 11/10. Num domingo, a semana corrente
 *   ainda não terminou: a "que passou" é a anterior.
 * - Obra planejada numa semana: tem ao menos um dia marcado (alocação) entre
 *   a segunda e o domingo.
 * - Obra que fechou a semana: existe o fechamento (`ops_week_closings`)
 *   daquela segunda.
 * - PPC da carteira: soma dos dias feitos ÷ soma dos dias marcados, só nos
 *   fechamentos da semana que passou das obras em execução.
 * - Obras paralisadas não entram nos denominadores de planejamento e de
 *   adoção (não são cobradas por não planejar), igual ao Painel.
 */
import { shiftISODate } from "@/lib/hojeDia";
import { mondayOf } from "@/lib/semanaPlan";
import { ppcOf, type ReasonCount } from "@/lib/semanaFechamento";
import { OPS_REASON_LABEL } from "@/lib/opsLabels";
import { formatBRL, RISK_LABEL, RISK_ORDER, summarize, type ObraRow } from "@/lib/obrasPainel";
import type { OpsBlockReason } from "@/infra/repositories/ops.repository";

/** Semanas terminadas que entram na adoção. */
export const ADOCAO_SEMANAS = 4;
/** Itens da lista "Precisa de atenção". */
export const ATENCAO_MAX = 5;
/** Itens da lista de atenção no texto do WhatsApp (o texto precisa ser curto). */
export const ATENCAO_MAX_TEXTO = 3;
/** Janela (dias corridos) das entregas contratuais "nas próximas 2 semanas". */
export const ENTREGAS_JANELA_DIAS = 14;
/** Rótulo da linha das obras sem responsável no Painel. */
export const SEM_RESPONSAVEL = "Sem responsável";

export interface ResumoAssignment {
  project_id: string | null;
  work_date: string;
}

export interface ResumoClosing {
  project_id: string | null;
  week_start: string;
  planned: number;
  done: number;
  /** Contagem por motivo do não feito, gravada pelo banco no fechamento. */
  reasons?: unknown;
}

// ---------------------------------------------------------------------------
// Semanas
// ---------------------------------------------------------------------------

export interface ResumoWeeks {
  /** Segunda da semana corrente (a de hoje). */
  current: string;
  /** Segunda da última semana terminada. */
  last: string;
  /** Segundas das semanas da adoção, da mais antiga para a mais recente (termina em `last`). */
  history: string[];
  /** Intervalo de dias que as alocações precisam cobrir (histórico + semana corrente). */
  from: string;
  to: string;
}

export function resumoWeeks(today: string, weeks = ADOCAO_SEMANAS): ResumoWeeks {
  const current = mondayOf(today);
  const last = shiftISODate(current, -7);
  const history = Array.from({ length: weeks }, (_, i) => shiftISODate(last, -7 * (weeks - 1 - i)));
  return { current, last, history, from: history[0], to: shiftISODate(current, 6) };
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "5–11/out" ou, virando o mês, "28/set–4/out". Segunda a domingo. */
export function weekShortLabel(monday: string): string {
  const sunday = shiftISODate(monday, 6);
  const day = (iso: string) => String(Number(iso.slice(8, 10)));
  const mon = (iso: string) => MESES[Number(iso.slice(5, 7)) - 1];
  return mon(monday) === mon(sunday)
    ? `${day(monday)}–${day(sunday)}/${mon(sunday)}`
    : `${day(monday)}/${mon(monday)}–${day(sunday)}/${mon(sunday)}`;
}

/** "5/out" — rótulo curto da coluna de uma semana. */
export function mondayShortLabel(monday: string): string {
  return `${Number(monday.slice(8, 10))}/${MESES[Number(monday.slice(5, 7)) - 1]}`;
}

// ---------------------------------------------------------------------------
// Tipos do resultado
// ---------------------------------------------------------------------------

export interface SemanaQuePassou {
  monday: string;
  label: string;
  /** PPC das obras em execução que fecharam a semana (null = ninguém fechou). */
  ppc: number | null;
  done: number;
  planned: number;
  /** Obras em execução que fecharam a semana. */
  closed: number;
  /** Obras em execução com ao menos um dia marcado na semana. */
  withPlan: number;
  /** Obras em execução (não paralisadas) sem nenhum dia marcado na semana. */
  withoutPlan: number;
  /** Motivos do não feito somados (só semanas fechadas), do mais frequente ao menos. */
  reasons: ReasonCount[];
}

export interface CarteiraAgora {
  active: number;
  red: number;
  yellow: number;
  noDeadline: number;
  penaltyTotal: number;
  /** Obras atrasadas sem valor/percentual de multa no contrato. */
  penaltyUnknown: number;
  /** Entregas contratuais de hoje até hoje + 14 dias, da mais próxima à mais distante. */
  deliveries: { id: string; name: string; deadline: string }[];
  paused: number;
}

export interface AtencaoItem {
  id: string;
  name: string;
  responsible: string | null;
  risk: ObraRow["risk"];
  slack: number | null;
  penalty: number | null;
  /** Um motivo curto, tirado dos alertas do Painel. */
  reason: string;
}

export interface AdocaoSemana {
  monday: string;
  planned: number;
  closed: number;
}

export interface AdocaoGestor {
  /** null = obras sem responsável no Painel. */
  responsibleId: string | null;
  name: string;
  /** Obras em execução sob a responsabilidade (inclui paralisadas). */
  obras: number;
  /** Obras que contam para a adoção (em execução e não paralisadas). */
  n: number;
  /** Uma por semana da adoção, da mais antiga para a mais recente. */
  weeks: AdocaoSemana[];
  /** % de obra-semanas fechadas nas 4 semanas (null quando n = 0). */
  closedRate: number | null;
  /** % de obra-semanas planejadas nas 4 semanas (null quando n = 0). */
  plannedRate: number | null;
  /** Obras com ao menos um dia marcado na semana corrente. */
  plannedThisWeek: number;
  /** PPC da semana que passou nos fechamentos das obras dele. */
  lastPpc: number | null;
}

export interface ResumoSemanal {
  today: string;
  weeks: ResumoWeeks;
  semana: SemanaQuePassou;
  carteira: CarteiraAgora;
  atencao: AtencaoItem[];
  adocao: AdocaoGestor[];
}

export interface ResumoInput {
  /** Linhas do Painel (obras em execução), já calculadas por `buildObraRow`. */
  rows: readonly ObraRow[];
  /** Alocações de `weeks.from` a `weeks.to` (pode vir com sobra: é filtrado). */
  assignments: readonly ResumoAssignment[];
  /** Fechamentos das semanas da adoção (pode vir com sobra: é filtrado). */
  closings: readonly ResumoClosing[];
  today: string;
}

// ---------------------------------------------------------------------------
// Cálculo
// ---------------------------------------------------------------------------

/** % inteiro; null quando não há base. */
export function rateOf(part: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((100 * part) / total);
}

/** Soma os motivos gravados nos fechamentos (`{ material: 2, clima: 1 }`). */
export function sumReasons(closings: readonly Pick<ResumoClosing, "reasons">[]): ReasonCount[] {
  const counts = new Map<OpsBlockReason, number>();
  for (const c of closings) {
    const r = c.reasons;
    if (!r || typeof r !== "object" || Array.isArray(r)) continue;
    for (const [key, value] of Object.entries(r as Record<string, unknown>)) {
      if (!(key in OPS_REASON_LABEL)) continue;
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) continue;
      const reason = key as OpsBlockReason;
      counts.set(reason, (counts.get(reason) ?? 0) + n);
    }
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, label: OPS_REASON_LABEL[reason], count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
}

/** Motivo curto da obra: o primeiro alerta que não é só informativo. */
export function atencaoReason(row: Pick<ObraRow, "alerts" | "risk">): string {
  return (row.alerts.find((a) => a.tone !== "muted") ?? row.alerts[0])?.text ?? RISK_LABEL[row.risk];
}

/** Vermelho antes de amarelo; dentro, mais dias úteis de atraso, depois maior multa, depois nome. */
export function compareAtencao(a: ObraRow, b: ObraRow): number {
  const r = RISK_ORDER[a.risk] - RISK_ORDER[b.risk];
  if (r !== 0) return r;
  const sa = a.slack ?? Number.POSITIVE_INFINITY;
  const sb = b.slack ?? Number.POSITIVE_INFINITY;
  if (sa !== sb) return sa - sb;
  const pa = a.penalty ?? 0;
  const pb = b.penalty ?? 0;
  if (pa !== pb) return pb - pa;
  return a.name.localeCompare(b.name, "pt-BR");
}

const isPaused = (r: ObraRow) => r.cadastro?.paused === true;

export function buildResumo(input: ResumoInput): ResumoSemanal {
  const { rows, today } = input;
  const weeks = resumoWeeks(today);
  const ids = new Set(rows.map((r) => r.id));

  // Semana (segunda) → obras com dia marcado; só obras em execução.
  const plannedBy = new Map<string, Set<string>>();
  for (const a of input.assignments) {
    if (!a.project_id || !ids.has(a.project_id)) continue;
    const monday = mondayOf(a.work_date);
    let set = plannedBy.get(monday);
    if (!set) plannedBy.set(monday, (set = new Set()));
    set.add(a.project_id);
  }
  // Fechamentos das obras em execução, por "obra|segunda" (fechamento de obra
  // entregue, cancelada ou em projeto não entra em nada).
  const closingBy = new Map<string, ResumoClosing>();
  for (const c of input.closings) {
    if (!c.project_id || !ids.has(c.project_id)) continue;
    closingBy.set(`${c.project_id}|${c.week_start}`, c);
  }
  const isPlanned = (id: string, monday: string) => plannedBy.get(monday)?.has(id) ?? false;
  const closingOf = (id: string, monday: string) => closingBy.get(`${id}|${monday}`) ?? null;

  // A semana que passou -------------------------------------------------
  const last = weeks.last;
  const lastClosings = rows.map((r) => closingOf(r.id, last)).filter((c): c is ResumoClosing => !!c);
  const done = lastClosings.reduce((s, c) => s + Number(c.done ?? 0), 0);
  const planned = lastClosings.reduce((s, c) => s + Number(c.planned ?? 0), 0);
  const semana: SemanaQuePassou = {
    monday: last,
    label: weekShortLabel(last),
    ppc: ppcOf(done, planned),
    done,
    planned,
    closed: lastClosings.length,
    withPlan: rows.filter((r) => isPlanned(r.id, last)).length,
    withoutPlan: rows.filter((r) => !isPaused(r) && !isPlanned(r.id, last)).length,
    reasons: sumReasons(lastClosings),
  };

  // Carteira agora -------------------------------------------------------
  const sum = summarize(rows);
  const horizon = shiftISODate(today, ENTREGAS_JANELA_DIAS);
  const carteira: CarteiraAgora = {
    active: sum.active,
    red: sum.red,
    yellow: sum.yellow,
    noDeadline: sum.noDeadline,
    penaltyTotal: sum.penaltyTotal,
    penaltyUnknown: sum.penaltyUnknown,
    deliveries: rows
      .filter((r) => !!r.deadline && r.deadline >= today && r.deadline <= horizon)
      .map((r) => ({ id: r.id, name: r.name, deadline: r.deadline as string }))
      .sort((a, b) => a.deadline.localeCompare(b.deadline) || a.name.localeCompare(b.name, "pt-BR")),
    paused: rows.filter(isPaused).length,
  };

  // Precisa de atenção ---------------------------------------------------
  const atencao: AtencaoItem[] = rows
    .filter((r) => r.risk === "vermelho" || r.risk === "amarelo")
    .sort(compareAtencao)
    .slice(0, ATENCAO_MAX)
    .map((r) => ({
      id: r.id,
      name: r.name,
      responsible: r.responsible,
      risk: r.risk,
      slack: r.slack,
      penalty: r.penalty,
      reason: atencaoReason(r),
    }));

  // Adoção por gestor ----------------------------------------------------
  const groups = new Map<string, { id: string | null; name: string; rows: ObraRow[] }>();
  for (const r of rows) {
    const key = r.responsibleId ?? "";
    let g = groups.get(key);
    if (!g) {
      g = { id: r.responsibleId, name: r.responsibleId ? r.responsible ?? "Responsável" : SEM_RESPONSAVEL, rows: [] };
      groups.set(key, g);
    }
    g.rows.push(r);
  }
  const adocao: AdocaoGestor[] = [...groups.values()].map((g) => {
    const counted = g.rows.filter((r) => !isPaused(r));
    const n = counted.length;
    const weekStats = weeks.history.map((monday) => ({
      monday,
      planned: counted.filter((r) => isPlanned(r.id, monday)).length,
      closed: counted.filter((r) => !!closingOf(r.id, monday)).length,
    }));
    const totalClosed = weekStats.reduce((s, w) => s + w.closed, 0);
    const totalPlanned = weekStats.reduce((s, w) => s + w.planned, 0);
    const mine = g.rows.map((r) => closingOf(r.id, last)).filter((c): c is ResumoClosing => !!c);
    return {
      responsibleId: g.id,
      name: g.name,
      obras: g.rows.length,
      n,
      weeks: weekStats,
      closedRate: rateOf(totalClosed, n * weeks.history.length),
      plannedRate: rateOf(totalPlanned, n * weeks.history.length),
      plannedThisWeek: counted.filter((r) => isPlanned(r.id, weeks.current)).length,
      lastPpc: ppcOf(
        mine.reduce((s, c) => s + Number(c.done ?? 0), 0),
        mine.reduce((s, c) => s + Number(c.planned ?? 0), 0),
      ),
    };
  });
  adocao.sort(compareAdocao);

  return { today, weeks, semana, carteira, atencao, adocao };
}

/** Menor adoção primeiro (fechadas, depois planejadas); quem não tem obra a cobrar vai para o fim. */
export function compareAdocao(a: AdocaoGestor, b: AdocaoGestor): number {
  const ca = a.closedRate ?? Number.POSITIVE_INFINITY;
  const cb = b.closedRate ?? Number.POSITIVE_INFINITY;
  if (ca !== cb) return ca - cb;
  const pa = a.plannedRate ?? Number.POSITIVE_INFINITY;
  const pb = b.plannedRate ?? Number.POSITIVE_INFINITY;
  if (pa !== pb) return pa - pb;
  if (a.n !== b.n) return b.n - a.n;
  // "Sem responsável" depois das pessoas, em empate.
  if ((a.responsibleId == null) !== (b.responsibleId == null)) return a.responsibleId == null ? 1 : -1;
  return a.name.localeCompare(b.name, "pt-BR");
}

// ---------------------------------------------------------------------------
// Texto para o WhatsApp
// ---------------------------------------------------------------------------

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Uma linha por gestor: "Ana (3 obras): fechou 75% das semanas (9/12) ·
 * esta semana 2/3 planejadas · PPC 80%". O 9/12 conta obra × semana.
 */
export function adocaoLine(g: AdocaoGestor, weeksCount = ADOCAO_SEMANAS): string {
  if (g.n === 0) return `${g.name}: ${plural(g.obras, "obra paralisada", "obras paralisadas")}`;
  const closed = g.weeks.reduce((s, w) => s + w.closed, 0);
  const total = g.n * weeksCount;
  const parts = [
    `fechou ${g.closedRate ?? 0}% das semanas (${closed}/${total})`,
    `esta semana ${g.plannedThisWeek}/${g.n} planejadas`,
  ];
  if (g.lastPpc != null) parts.push(`PPC ${g.lastPpc}%`);
  return `${g.name} (${plural(g.n, "obra", "obras")}): ${parts.join(" · ")}`;
}

/** Texto curto, sem tabela, pronto para colar no WhatsApp. */
export function resumoWhatsApp(r: ResumoSemanal): string {
  const s = r.semana;
  const c = r.carteira;
  const lines: string[] = [];
  lines.push(`*Resumo da semana ${s.label}*`);
  const semana = [
    s.ppc == null ? "PPC: nenhuma obra fechou a semana" : `PPC ${s.ppc}% (${s.done} de ${s.planned} dias)`,
    `${s.closed}/${s.withPlan} obras planejadas fecharam`,
  ];
  if (s.withoutPlan > 0) semana.push(`${s.withoutPlan} sem planejamento`);
  lines.push(semana.join(" · "));
  const carteira = [`${plural(c.active, "obra", "obras")} em execução`, `${c.red} no vermelho`, `${c.yellow} em atenção`];
  if (c.noDeadline > 0) carteira.push(`${c.noDeadline} sem prazo`);
  if (c.paused > 0) carteira.push(plural(c.paused, "paralisada", "paralisadas"));
  lines.push(carteira.join(" · "));
  const extra: string[] = [];
  if (c.penaltyTotal > 0) extra.push(`Multa projetada ${formatBRL(c.penaltyTotal)}`);
  if (c.deliveries.length > 0) {
    extra.push(`${plural(c.deliveries.length, "entrega", "entregas")} em 2 semanas (${c.deliveries.map((d) => d.name).join(", ")})`);
  }
  if (extra.length > 0) lines.push(extra.join(" · "));
  if (s.reasons.length > 0) {
    lines.push(`Não feito: ${s.reasons.slice(0, 3).map((x) => `${x.label.toLowerCase()} (${x.count})`).join(", ")}`);
  }
  if (r.atencao.length > 0) {
    const shown = r.atencao.slice(0, ATENCAO_MAX_TEXTO);
    const more = r.atencao.length - shown.length;
    lines.push(more > 0 ? `*Atenção* (+${more} no Painel)` : "*Atenção*");
    for (const a of shown) lines.push(`• ${a.name}: ${a.reason}`);
  }
  if (r.adocao.length > 0) {
    lines.push(`*Gestores (últimas ${ADOCAO_SEMANAS} semanas)*`);
    for (const g of r.adocao) lines.push(`• ${adocaoLine(g)}`);
  }
  return lines.join("\n");
}
