/**
 * Regras puras do Cronograma interno (staff-only).
 *
 * Fora dos componentes para serem testáveis: árvore item → micro-etapas,
 * agrupamento por etapa, comparação com o cronograma do cliente, resumo de
 * entrega e reordenação. Datas são sempre `yyyy-mm-dd` (colunas `date`):
 * comparar strings basta, sem `new Date('yyyy-mm-dd')` (que cai em UTC).
 */
import { parseISODate, toISODate } from "@/lib/hojeDia";

/** O mínimo de um item interno que estas regras precisam. */
export interface ScheduleItemLike {
  id: string;
  parent_id: string | null;
  client_activity_id: string | null;
  etapa: string | null;
  description: string;
  planned_start: string;
  planned_end: string;
  sort_order: number;
}

/** O mínimo de uma atividade do cliente para comparar datas. */
export interface ClientDatesLike {
  id: string;
  planned_start: string;
  planned_end: string;
}

export interface ScheduleNode<T extends ScheduleItemLike> {
  item: T;
  children: T[];
}

export interface EtapaGroup<T extends ScheduleItemLike> {
  /** null = itens sem etapa (ou cronograma sem nenhuma etapa: lista simples). */
  etapa: string | null;
  nodes: ScheduleNode<T>[];
}

const bySortOrder = <T extends ScheduleItemLike>(a: T, b: T) =>
  a.sort_order - b.sort_order ||
  a.planned_start.localeCompare(b.planned_start) ||
  a.id.localeCompare(b.id);

/**
 * Item de primeiro nível com as micro-etapas embaixo. Micro-etapa cujo pai
 * não veio na lista (não deveria acontecer) sobe para o primeiro nível,
 * para nunca sumir da tela.
 */
export function buildTree<T extends ScheduleItemLike>(items: readonly T[]): ScheduleNode<T>[] {
  const ids = new Set(items.map((i) => i.id));
  const childrenOf = new Map<string, T[]>();
  const roots: T[] = [];
  for (const it of items) {
    if (it.parent_id && ids.has(it.parent_id)) {
      const list = childrenOf.get(it.parent_id) ?? [];
      list.push(it);
      childrenOf.set(it.parent_id, list);
    } else {
      roots.push(it);
    }
  }
  return [...roots].sort(bySortOrder).map((item) => ({
    item,
    children: [...(childrenOf.get(item.id) ?? [])].sort(bySortOrder),
  }));
}

const etapaKey = (etapa: string | null) => {
  const t = etapa?.trim();
  return t ? t : null;
};

/**
 * Agrupa os itens de primeiro nível por etapa, na ordem do cronograma (a
 * etapa aparece onde aparece o primeiro item dela). Sem nenhuma etapa
 * preenchida, devolve um grupo só com `etapa: null` (lista simples).
 */
export function groupByEtapa<T extends ScheduleItemLike>(nodes: readonly ScheduleNode<T>[]): EtapaGroup<T>[] {
  const groups: EtapaGroup<T>[] = [];
  const index = new Map<string | null, EtapaGroup<T>>();
  for (const node of nodes) {
    const key = etapaKey(node.item.etapa);
    let g = index.get(key);
    if (!g) {
      g = { etapa: key, nodes: [] };
      index.set(key, g);
      groups.push(g);
    }
    g.nodes.push(node);
  }
  return groups;
}

/** "03/11" a partir de yyyy-mm-dd. */
export function ddmm(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** "03/11–14/11". */
export function rangeLabel(start: string, end: string): string {
  return `${ddmm(start)}–${ddmm(end)}`;
}

export type ClientComparison =
  /** Item sem atividade do cliente (criado na equipe, ou a do cliente foi apagada). */
  | { kind: "so_interno" }
  /** Mesmas datas do cliente. */
  | { kind: "igual"; client: ClientDatesLike }
  /** Datas diferentes das do cliente. */
  | { kind: "diferente"; client: ClientDatesLike; label: string };

export function compareWithClient(
  item: Pick<ScheduleItemLike, "client_activity_id" | "planned_start" | "planned_end">,
  clientById: ReadonlyMap<string, ClientDatesLike>,
): ClientComparison {
  const client = item.client_activity_id ? clientById.get(item.client_activity_id) : undefined;
  if (!client) return { kind: "so_interno" };
  if (client.planned_start === item.planned_start && client.planned_end === item.planned_end) {
    return { kind: "igual", client };
  }
  return { kind: "diferente", client, label: `Cliente: ${rangeLabel(client.planned_start, client.planned_end)}` };
}

export type DeliveryStatus = "risco" | "folga" | "igual";

export interface DeliverySummary {
  /** Maior fim previsto do cronograma interno (null = sem itens). */
  internalEnd: string | null;
  /** Maior fim previsto do cronograma do cliente (null = sem atividades). */
  clientEnd: string | null;
  /** null quando falta um dos dois lados. */
  status: DeliveryStatus | null;
  /** Dias corridos entre as duas entregas (sempre ≥ 0). */
  days: number;
}

const maxEnd = (list: ReadonlyArray<{ planned_end: string }>): string | null =>
  list.reduce<string | null>((acc, x) => (x.planned_end && (!acc || x.planned_end > acc) ? x.planned_end : acc), null);

/**
 * Entrega interna × entrega do cliente. Interna depois da do cliente =
 * risco (a equipe planeja terminar depois do prometido); antes = folga.
 * Diferença em dias corridos: a entrega do cliente pode cair num sábado, e
 * "0 dia útil" de folga não diria nada.
 */
export function deliverySummary(
  internal: ReadonlyArray<{ planned_end: string }>,
  client: ReadonlyArray<{ planned_end: string }>,
): DeliverySummary {
  const internalEnd = maxEnd(internal);
  const clientEnd = maxEnd(client);
  if (!internalEnd || !clientEnd) return { internalEnd, clientEnd, status: null, days: 0 };
  if (internalEnd === clientEnd) return { internalEnd, clientEnd, status: "igual", days: 0 };
  return {
    internalEnd,
    clientEnd,
    status: internalEnd > clientEnd ? "risco" : "folga",
    days: Math.abs(daysBetween(clientEnd, internalEnd)),
  };
}

/** Dias corridos de `a` até `b` (datas locais; arredonda a hora de verão). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);
}

/** "1 dia" / "3 dias". */
export function daysLabel(n: number): string {
  return `${n} ${n === 1 ? "dia" : "dias"}`;
}

/**
 * Move um item uma posição entre os irmãos (`siblings` na ordem da tela) e
 * devolve só as linhas cuja `sort_order` muda. Reaproveita os valores de
 * ordem que o grupo já tinha (o grupo não muda de lugar no cronograma);
 * valores repetidos viram uma sequência crescente.
 */
export function moveWithinSiblings<T extends Pick<ScheduleItemLike, "id" | "sort_order">>(
  siblings: readonly T[],
  id: string,
  direction: "up" | "down",
): Array<{ id: string; sort_order: number }> {
  const from = siblings.findIndex((s) => s.id === id);
  if (from < 0) return [];
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= siblings.length) return [];

  const values = siblings.map((s) => s.sort_order).sort((a, b) => a - b);
  for (let i = 1; i < values.length; i++) {
    if (values[i] <= values[i - 1]) values[i] = values[i - 1] + 1;
  }
  const order = [...siblings];
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved);

  const changes: Array<{ id: string; sort_order: number }> = [];
  order.forEach((s, i) => {
    if (s.sort_order !== values[i]) changes.push({ id: s.id, sort_order: values[i] });
  });
  return changes;
}

/** Próxima ordem livre (novo item vai para o fim). */
export function nextSortOrder(items: ReadonlyArray<{ sort_order: number }>): number {
  return items.reduce((m, i) => Math.max(m, i.sort_order), -1) + 1;
}

/** Valida as datas de um item antes de gravar. Retorna a mensagem ou null. */
export function validateItemDates(v: {
  planned_start: string;
  planned_end: string;
  actual_start?: string | null;
  actual_end?: string | null;
}): string | null {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(v.planned_start) || !iso.test(v.planned_end)) return "Informe início e fim previstos.";
  if (v.planned_end < v.planned_start) return "O fim previsto não pode ser antes do início previsto.";
  if (v.actual_start && v.actual_end && v.actual_end < v.actual_start) {
    return "O término real não pode ser antes do início real.";
  }
  return null;
}

/** Quantos itens ligados ao cliente têm datas previstas diferentes das do cliente. */
export function countClientDifferences(
  items: ReadonlyArray<Pick<ScheduleItemLike, "client_activity_id" | "planned_start" | "planned_end">>,
  clientById: ReadonlyMap<string, ClientDatesLike>,
): number {
  return items.reduce((n, it) => (compareWithClient(it, clientById).kind === "diferente" ? n + 1 : n), 0);
}

/** "dd/mm" no fuso local a partir de um timestamp (timestamptz do banco). */
export function ddmmFromTimestamp(ts: string): string {
  return ddmm(toISODate(new Date(ts)));
}
