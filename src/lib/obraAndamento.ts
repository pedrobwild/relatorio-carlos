/**
 * Andamento da obra pelo cronograma INTERNO — o que o Painel de Obras mostra
 * para responder, de bate-pronto:
 *
 *   - Em que etapa a obra está (e quantas faltam)?
 *   - O que deveria estar acontecendo hoje — e se de fato começou?
 *   - O que está atrasado?
 *   - O que começa na semana que vem — e se a semana já foi planejada?
 *
 * Etapa = item de 1º nível do cronograma interno. Micro-etapa = item de 2º
 * nível (filho). "Agora" e "Próxima semana" usam o nível mais detalhado que
 * existir (a micro-etapa, quando há; senão a própria etapa).
 *
 * Datas reais: um item está "em andamento" quando tem início real e não tem
 * término real. Etapa com micro-etapas herda das filhas: começou quando a
 * primeira filha começou e terminou quando todas terminaram.
 *
 * Regras puras (sem React, sem banco) para serem testáveis.
 */
import { businessDaysAfter, ddmm } from "@/lib/obrasPainel";
import type { PortfolioStage } from "@/infra/repositories/obrasPanel.repository";

export type ItemState =
  /** Tem término real. */
  | "concluida"
  /** Passou do fim previsto e não terminou. */
  | "atrasada"
  /** Começou (início real) e está dentro do previsto. */
  | "em_andamento"
  /** Pelo cronograma já deveria ter começado, mas não há início real. */
  | "sem_inicio"
  /** Começa depois de hoje. */
  | "futura";

export interface AndamentoItem {
  id: string;
  name: string;
  /** Nome da etapa-mãe, quando o item é micro-etapa. */
  parentName: string | null;
  start: string;
  end: string;
  actualStart: string | null;
  actualEnd: string | null;
  state: ItemState;
  /** Dias úteis de atraso (no término; ou no início, para `sem_inicio`). */
  lateDays: number;
}

export interface ObraAndamento {
  /** Etapas de 1º nível, na ordem do cronograma. */
  etapas: AndamentoItem[];
  /** Etapa em que a obra está hoje (null = sem cronograma). */
  atual: AndamentoItem | null;
  /** Posição da etapa atual (1-based) e total de etapas. */
  posicao: { n: number; total: number } | null;
  /**
   * Situação da obra no cronograma, em uma frase curta:
   *   "antes"     cronograma ainda não começou
   *   "andamento" há etapa prevista para hoje
   *   "intervalo" entre etapas (nada previsto para hoje)
   *   "fim"       todas as etapas concluídas
   *   "vencido"   o cronograma acabou e ainda há etapa aberta
   */
  fase: "antes" | "andamento" | "intervalo" | "fim" | "vencido" | "sem_cronograma";
  /** O que deveria estar acontecendo hoje, mais o que está atrasado. */
  agora: AndamentoItem[];
  /** O que começa na próxima semana (seg–dom). */
  proximaSemana: AndamentoItem[];
  /** O que já está correndo (ou atrasado) e segue na próxima semana. */
  continuaProximaSemana: AndamentoItem[];
  /** A próxima semana usada no cálculo. */
  semanaQueVem: { from: string; to: string };
  /** Próximo item a começar depois de hoje (para "intervalo"/"antes"). */
  proximo: AndamentoItem | null;
  /** Concluídas / total de etapas. */
  concluidas: number;
  /** Primeiro início e último fim previstos (eixo da linha do tempo). */
  inicio: string | null;
  fim: string | null;
}

type Stage = Pick<
  PortfolioStage,
  "id" | "description" | "sort_order" | "planned_start" | "planned_end" | "actual_start" | "actual_end"
> & { parent_id?: string | null };

function stateOf(
  dates: { start: string; end: string; actualStart: string | null; actualEnd: string | null },
  today: string,
): { state: ItemState; lateDays: number } {
  if (dates.actualEnd) return { state: "concluida", lateDays: 0 };
  if (dates.end < today) return { state: "atrasada", lateDays: businessDaysAfter(dates.end, today) };
  if (dates.actualStart) return { state: "em_andamento", lateDays: 0 };
  if (dates.start <= today) return { state: "sem_inicio", lateDays: businessDaysAfter(dates.start, today) };
  return { state: "futura", lateDays: 0 };
}

const bySort = (a: Stage, b: Stage) =>
  a.sort_order - b.sort_order || a.planned_start.localeCompare(b.planned_start) || a.description.localeCompare(b.description);

/**
 * Calcula o andamento a partir das linhas do cronograma interno de UMA obra.
 * `nextWeek` = segunda e domingo da semana seguinte à de hoje.
 */
export function buildAndamento(
  stages: readonly Stage[],
  today: string,
  nextWeek: { from: string; to: string },
): ObraAndamento {
  const valid = stages.filter((s) => s.planned_start && s.planned_end);
  const ids = new Set(valid.map((s) => s.id));
  const children = new Map<string, Stage[]>();
  const tops: Stage[] = [];
  for (const s of valid) {
    if (s.parent_id && ids.has(s.parent_id)) {
      const list = children.get(s.parent_id) ?? [];
      list.push(s);
      children.set(s.parent_id, list);
    } else {
      tops.push(s);
    }
  }
  tops.sort(bySort);

  const toItem = (s: Stage, parentName: string | null, kids?: readonly Stage[]): AndamentoItem => {
    let actualStart = s.actual_start;
    let actualEnd = s.actual_end;
    if (kids && kids.length > 0) {
      const starts = kids.map((k) => k.actual_start).filter((d): d is string => !!d);
      if (!actualStart && starts.length > 0) actualStart = starts.sort()[0];
      if (!actualEnd && kids.every((k) => k.actual_end)) {
        actualEnd = kids.map((k) => k.actual_end as string).sort().at(-1) ?? null;
      }
    }
    const dates = { start: s.planned_start, end: s.planned_end, actualStart, actualEnd };
    return { id: s.id, name: s.description, parentName, ...dates, ...stateOf(dates, today) };
  };

  const etapas = tops.map((t) => toItem(t, null, children.get(t.id)));
  /** Nível mais detalhado: micro-etapas onde houver, senão a etapa. */
  const leaves: AndamentoItem[] = tops.flatMap((t) => {
    const kids = (children.get(t.id) ?? []).slice().sort(bySort);
    return kids.length > 0 ? kids.map((k) => toItem(k, t.description)) : [toItem(t, null)];
  });

  if (etapas.length === 0) {
    return {
      etapas,
      atual: null,
      posicao: null,
      fase: "sem_cronograma",
      agora: [],
      proximaSemana: [],
      continuaProximaSemana: [],
      semanaQueVem: nextWeek,
      proximo: null,
      concluidas: 0,
      inicio: null,
      fim: null,
    };
  }

  const inicio = etapas.reduce((m, e) => (e.start < m ? e.start : m), etapas[0].start);
  const fim = etapas.reduce((m, e) => (e.end > m ? e.end : m), etapas[0].end);
  const concluidas = etapas.filter((e) => e.state === "concluida").length;
  const abertas = etapas.filter((e) => e.state !== "concluida");

  // Etapa atual: a primeira (na ordem do cronograma) que está aberta e já
  // deveria ter começado — atrasada, em andamento ou sem início registrado.
  // Etapa em andamento de fato tem preferência sobre a atrasada só na ordem:
  // a que vem antes no cronograma é a "atual"; as outras aparecem em "Agora".
  const correndo = abertas.filter((e) => e.state !== "futura");
  const proximoEtapa = abertas.filter((e) => e.state === "futura").sort((a, b) => a.start.localeCompare(b.start))[0] ?? null;
  const atual = correndo[0] ?? proximoEtapa ?? null;

  let fase: ObraAndamento["fase"];
  if (abertas.length === 0) fase = "fim";
  else if (today < inicio) fase = "antes";
  else if (today > fim) fase = "vencido";
  else if (correndo.length > 0) fase = "andamento";
  else fase = "intervalo";

  const ordem = (e: AndamentoItem) => (e.state === "atrasada" ? 0 : e.state === "sem_inicio" ? 1 : 2);
  const agora = leaves
    .filter((l) => l.state === "atrasada" || l.state === "em_andamento" || l.state === "sem_inicio")
    .sort((a, b) => ordem(a) - ordem(b) || b.lateDays - a.lateDays || a.start.localeCompare(b.start));

  const proximaSemana = leaves
    .filter((l) => l.state === "futura" && l.start >= nextWeek.from && l.start <= nextWeek.to)
    .sort((a, b) => a.start.localeCompare(b.start));

  const proximo = leaves.filter((l) => l.state === "futura").sort((a, b) => a.start.localeCompare(b.start))[0] ?? null;

  const idx = atual ? etapas.findIndex((e) => e.id === atual.id) : -1;
  return {
    etapas,
    atual,
    posicao: idx >= 0 ? { n: idx + 1, total: etapas.length } : null,
    fase,
    agora,
    proximaSemana,
    // Atrasada também "continua": sem término real, ela entra na semana que vem.
    continuaProximaSemana: agora.filter((i) => i.state === "atrasada" || i.end >= nextWeek.from),
    semanaQueVem: nextWeek,
    proximo,
    concluidas,
    inicio,
    fim,
  };
}

/** Texto curto do estado de um item, para a tela. */
export function itemStateLabel(item: Pick<AndamentoItem, "state" | "lateDays" | "start" | "end" | "actualEnd">): string {
  const d = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;
  switch (item.state) {
    case "concluida":
      return item.actualEnd ? `concluída ${ddmm(item.actualEnd)}` : "concluída";
    case "atrasada":
      return `atrasada ${d(item.lateDays)} (fim ${ddmm(item.end)})`;
    case "em_andamento":
      return `em andamento até ${ddmm(item.end)}`;
    case "sem_inicio":
      return item.lateDays > 0 ? `sem início registrado (previsto ${ddmm(item.start)})` : "começa hoje";
    case "futura":
      return `começa ${ddmm(item.start)}`;
  }
}

/** Posição de uma data no eixo [inicio, fim], de 0 a 1. */
export function axisPosition(iso: string, inicio: string, fim: string): number {
  const t = (s: string) => Date.parse(`${s}T00:00:00Z`);
  const span = t(fim) - t(inicio);
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (t(iso) - t(inicio)) / span));
}
